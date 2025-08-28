// server/src/controllers/orders.controller.js
const mongoose = require('mongoose')
const Order   = require('../models/Order')
const Food    = require('../models/Food')
const Package = require('../models/Package')

const STATUS = {
  PLACED:    'PLACED',
  ACCEPTED:  'ACCEPTED',
  COOKING:   'COOKING',
  READY:     'READY',
  DELIVERED: 'DELIVERED',
  CANCELED:  'CANCELED',
}
const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']

function emitOrder (req, orderObj, event) {
  const io = req.app.get('io')
  if (!io) return
  io.to('room:admin').emit(event, orderObj)
  io.to('room:chef:default').emit(event, orderObj)
  if (orderObj.customerId) io.to(`room:customer:${orderObj.customerId}`).emit(event, orderObj)
  io.to(`room:order:${orderObj._id}`).emit(event, orderObj)
}

/* ---------- stock helpers ---------- */

// Build maps for foods and packages separately
function buildPackageMap(items) {
  const pkgMap = new Map() // packageId -> qty
  for (const it of items) {
    if (String(it.kind).toUpperCase() !== 'PACKAGE' || !it.packageId) continue
    const q = Math.max(1, parseInt(it.qty, 10) || 1)
    const k = String(it.packageId)
    pkgMap.set(k, (pkgMap.get(k) || 0) + q)
  }
  return pkgMap
}

/** Expand items to foodId -> qty (includes package contents) */
async function expandToFoods(items) {
  const map = new Map()
  for (const it of items) {
    const qty = Math.max(1, parseInt(it.qty, 10) || 1)
    if (String(it.kind).toUpperCase() === 'FOOD' && it.foodId) {
      const k = String(it.foodId)
      map.set(k, (map.get(k) || 0) + qty)
    } else if (String(it.kind).toUpperCase() === 'PACKAGE' && it.packageId) {
      const pkg = await Package.findById(it.packageId).lean()
      if (!pkg) throw new Error('Package not found')
      for (const line of (pkg.items || [])) {
        const add = qty * Math.max(1, parseInt(line.qty, 10) || 1)
        const k = String(line.foodId)
        map.set(k, (map.get(k) || 0) + add)
      }
    }
  }
  return map
}

// Reserve package counts (if dailyLimit is set)
async function reservePackages(session, pkgMap) {
  // validate
  for (const [pkgId, need] of pkgMap) {
    const p = await Package.findById(pkgId).session(session)
    if (!p) throw new Error('Package not found')
    if (p.dailyLimit == null) continue
    const remaining = Number(p.stockRemaining ?? p.dailyLimit)
    if (remaining < need) {
      throw new Error(`Insufficient stock for package "${p.name}". Remaining ${remaining}, need ${need}.`)
    }
  }
  // decrement
  for (const [pkgId, need] of pkgMap) {
    const p = await Package.findById(pkgId).session(session)
    if (p.dailyLimit == null) continue
    p.stockRemaining = Number(p.stockRemaining ?? p.dailyLimit) - need
    await p.save({ session })
  }
}

// Restore package counts
async function restorePackages(session, pkgMap) {
  for (const [pkgId, qty] of pkgMap) {
    const p = await Package.findById(pkgId).session(session)
    if (!p) continue
    if (p.dailyLimit == null) continue
    p.stockRemaining = Number(p.stockRemaining ?? p.dailyLimit) + qty
    if (p.dailyLimit != null && p.stockRemaining > p.dailyLimit) {
      p.stockRemaining = p.dailyLimit
    }
    await p.save({ session })
  }
}

// Reserve foods
async function reserveFoods(session, foodMap) {
  for (const [foodId, need] of foodMap) {
    const f = await Food.findById(foodId).session(session)
    if (!f) throw new Error('Food not found')
    if (f.dailyLimit == null) continue
    const remaining = Number(f.stockRemaining ?? f.dailyLimit)
    if (remaining < need) {
      throw new Error(`Insufficient stock for "${f.name}". Remaining ${remaining}, need ${need}.`)
    }
  }
  for (const [foodId, need] of foodMap) {
    const f = await Food.findById(foodId).session(session)
    if (f.dailyLimit == null) continue
    f.stockRemaining = Number(f.stockRemaining ?? f.dailyLimit) - need
    await f.save({ session })
  }
}

// Restore foods
async function restoreFoods(session, foodMap) {
  for (const [foodId, qty] of foodMap) {
    const f = await Food.findById(foodId).session(session)
    if (!f) continue
    if (f.dailyLimit == null) continue
    f.stockRemaining = Number(f.stockRemaining ?? f.dailyLimit) + qty
    if (f.dailyLimit != null && f.stockRemaining > f.dailyLimit) {
      f.stockRemaining = f.dailyLimit
    }
    await f.save({ session })
  }
}

/* ---------- controllers ---------- */

// GET /orders?status=&type=&groupKey=&q=
async function list (req, res, next) {
  try {
    const { status, type, groupKey, q } = req.query
    const filter = {}

    if (status === 'ACTIVE') {
      filter.status = { $nin: [STATUS.DELIVERED, STATUS.CANCELED] }
    } else if (status) {
      filter.status = status
    }
    if (type) filter.type = type
    if (groupKey) filter.groupKey = groupKey
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i')
      filter.$or = [{ groupKey: rx }, { notes: rx }, { 'items.name': rx }]
    }

    const rows = await Order.find(filter).sort({ createdAt: -1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

// GET /orders/:id
async function getOne (req, res, next) {
  try {
    const row = await Order.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Order not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// POST /orders  (reserve foods + packages)
async function create (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const authedId = req.user?._id || req.user?.id
    if (!authedId) return res.status(401).json({ message: 'Unauthenticated' })

    const type = (req.body.type || 'INDIVIDUAL').toUpperCase()
    if (!ORDER_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid order type' })
    }

    const items = Array.isArray(req.body.items) ? req.body.items : []
    if (!items.length) return res.status(400).json({ message: 'At least one item is required' })

    // prepare snapshot items (free mode)
    const prepared = []
    for (const it of items) {
      const kind = String(it.kind || '').toUpperCase()
      const qty  = Math.max(1, parseInt(it.qty, 10) || 1)
      if (kind === 'FOOD') {
        const f = await Food.findById(it.foodId).select('_id name').session(session)
        if (!f) return res.status(400).json({ message: 'Food not found', id: it.foodId })
        prepared.push({ kind: 'FOOD', foodId: f._id, name: f.name, qty, unitPrice: 0 })
      } else if (kind === 'PACKAGE') {
        const p = await Package.findById(it.packageId).select('_id name').session(session)
        if (!p) return res.status(400).json({ message: 'Package not found', id: it.packageId })
        prepared.push({ kind: 'PACKAGE', packageId: p._id, name: p.name, qty, unitPrice: 0 })
      } else {
        return res.status(400).json({ message: 'Invalid item kind', kind: it.kind })
      }
    }

    // reserve both packages and foods
    const pkgMap  = buildPackageMap(items)
    const foodMap = await expandToFoods(items)
    await reservePackages(session, pkgMap)
    await reserveFoods(session,  foodMap)

    const [doc] = await Order.create([{
      type,
      status: STATUS.PLACED,
      customerId: authedId,
      groupKey: type === 'GROUP' ? (req.body.groupKey || null) : null,
      notes: req.body.notes || '',
      items: prepared,
      grandTotal: 0,
      stockCommitted: false,   // flips true on accept
      createdBy: authedId,
      updatedBy: authedId,
    }], { session })

    await session.commitTransaction()
    const order = doc.toObject()
    emitOrder(req, order, 'order:new')
    res.status(201).json(order)
  } catch (e) {
    await session.abortTransaction()
    next(e)
  } finally {
    session.endSession()
  }
}

// PATCH /orders/:id/accept  (commit reservation)
async function accept (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const order = await Order.findById(req.params.id).session(session)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== STATUS.PLACED) {
      return res.status(400).json({ message: `Order must be ${STATUS.PLACED} before accepting` })
    }

    order.status = STATUS.ACCEPTED
    order.acceptedAt = new Date()
    order.stockCommitted = true
    order.updatedBy = req.user?._id || null
    await order.save({ session })

    await session.commitTransaction()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) {
    await session.abortTransaction()
    next(e)
  } finally {
    session.endSession()
  }
}

// PATCH /orders/:id/start
async function start (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (![STATUS.ACCEPTED, STATUS.PLACED].includes(order.status)) {
      return res.status(400).json({ message: 'Order must be ACCEPTED (or PLACED) to start cooking' })
    }
    order.status = STATUS.COOKING
    order.cookingAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/ready
async function ready (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (![STATUS.COOKING, STATUS.ACCEPTED].includes(order.status)) {
      return res.status(400).json({ message: 'Order must be COOKING/ACCEPTED to mark READY' })
    }
    order.status = STATUS.READY
    order.readyAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/deliver
async function deliver (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== STATUS.READY) {
      return res.status(400).json({ message: 'Order must be READY to deliver' })
    }

    const role = req.user?.role
    const uid  = String(req.user?._id || '')
    if (role === 'CUSTOMER' && String(order.customerId) !== uid) {
      return res.status(403).json({ message: 'Customers can only deliver their own orders' })
    }

    order.status = STATUS.DELIVERED
    order.deliveredAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/cancel  (restore only if not committed)
async function cancel (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const order = await Order.findById(req.params.id).session(session)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if ([STATUS.DELIVERED, STATUS.CANCELED].includes(order.status)) {
      return res.status(400).json({ message: 'Order already finished' })
    }

    if (!order.stockCommitted) {
      const pkgMap  = buildPackageMap(order.items)
      const foodMap = await expandToFoods(order.items)
      await restorePackages(session, pkgMap)
      await restoreFoods(session,  foodMap)
    }

    order.status = STATUS.CANCELED
    order.canceledAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save({ session })

    await session.commitTransaction()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) {
    await session.abortTransaction()
    next(e)
  } finally {
    session.endSession()
  }
}

module.exports = {
  list,
  getOne,
  create,
  accept,
  start,
  ready,
  deliver,
  cancel,
}
