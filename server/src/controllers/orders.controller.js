// server/src/controllers/orders.controller.js
const mongoose     = require('mongoose')
const Order        = require('../models/Order')
const Food         = require('../models/Food')
const Package      = require('../models/Package')
const Ingredient   = require('../models/Ingredient')
const ChoiceGroup  = require('../models/ChoiceGroup')

const STATUS = {
  PLACED:    'PLACED',
  ACCEPTED:  'ACCEPTED',
  COOKING:   'COOKING',
  READY:     'READY',
  DELIVERED: 'DELIVERED',
  CANCELED:  'CANCELED',
}
const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']

/* ───────────────── helpers ───────────────── */

function emitOrder (req, orderObj, event) {
  const io = req.app.get('io')
  if (!io) return
  io.to('room:admin').emit(event, orderObj)
  io.to('room:chef:default').emit(event, orderObj)
  if (orderObj.customerId) io.to(`room:customer:${orderObj.customerId}`).emit(event, orderObj)
  io.to(`room:order:${orderObj._id}`).emit(event, orderObj)
}

// Ensure `customerId` is a string and attach `customerName`
function serializeOrder(o) {
  const x = o?.toObject ? o.toObject() : o || {}
  const cust = x.customerId
  const customerId = cust && typeof cust === 'object'
    ? String(cust._id || cust.id || '')
    : String(cust || '')
  const customerName = cust && typeof cust === 'object'
    ? (cust.name || null)
    : (x.customerName || null)
  return { ...x, customerId, customerName }
}

/** Expand request/order items to a map of foodId -> total qty (packages expanded) */
async function expandToFoods(items, session = null) {
  const map = new Map()
  for (const it of (items || [])) {
    const qty = Math.max(1, parseInt(it.qty, 10) || 1)
    const kind = String(it.kind || '').toUpperCase()
    if (kind === 'FOOD' && it.foodId) {
      const k = String(it.foodId)
      map.set(k, (map.get(k) || 0) + qty)
    } else if (kind === 'PACKAGE' && it.packageId) {
      const pkg = await Package.findById(it.packageId).session(session).lean()
      if (!pkg) throw new Error('Package not found')
      for (const line of (pkg.items || [])) {
        const add = qty * Math.max(1, parseInt(line.qty, 10) || 1)
        const k = String(line.foodId)
        map.set(k, (map.get(k) || 0) + add)
      }
    } else {
      throw new Error('Invalid item kind')
    }
  }
  return map
}

/** Atomically decrement stock for foods (null = unlimited → skip) */
async function decrementFoodsStock(session, foodMap) {
  for (const [foodId, need] of foodMap) {
    // fetch once to check unlimited vs numeric and availability
    const doc = await Food.findById(foodId)
      .select('_id name stockQty isActiveGlobal isActiveKitchen')
      .session(session)
    if (!doc) throw new Error('Food not found')
    if (!doc.isActiveGlobal || !doc.isActiveKitchen) {
      throw new Error(`"${doc.name}" is not available`)
    }
    if (doc.stockQty === null) continue // unlimited → no decrement
    const res = await Food.updateOne(
      { _id: foodId, stockQty: { $gte: need } },
      { $inc: { stockQty: -need } },
      { session }
    )
    if (res.matchedCount === 0) {
      throw new Error(`Not enough stock for "${doc.name}"`)
    }
  }
}

/** Increment back (only when stock is numeric) */
async function incrementFoodsStock(session, foodMap) {
  for (const [foodId, qty] of foodMap) {
    await Food.updateOne(
      { _id: foodId, stockQty: { $ne: null } },
      { $inc: { stockQty: qty } },
      { session }
    )
  }
}

/** Sanitize and normalize item.mods based on food attachments (Ingredients/ChoiceGroups) */
async function sanitizeModsForFood(foodDoc, submittedMods = []) {
  const clean = []
  const ingMap = new Map()
  const grpMap = new Map()

  // attachments on the food (populated in create())
  for (const it of (foodDoc.ingredients || [])) {
    const id = String(it.ingredientId?._id || it.ingredientId)
    ingMap.set(id, it)
  }
  for (const g of (foodDoc.choiceGroups || [])) {
    const id = String(g.groupId?._id || g.groupId)
    grpMap.set(id, g)
  }

  // load library definitions
  const ingIds = [...ingMap.keys()]
  const grpIds = [...grpMap.keys()]
  const [ingDefs, grpDefs] = await Promise.all([
    ingIds.length ? Ingredient.find({ _id: { $in: ingIds } }).lean() : [],
    grpIds.length ? ChoiceGroup.find({ _id: { $in: grpIds } }).lean() : []
  ])
  const ingDefMap = new Map(ingDefs.map(x => [String(x._id), x]))
  const grpDefMap = new Map(grpDefs.map(x => [String(x._id), x]))

  for (const m of (submittedMods || [])) {
    const kind = String(m.kind || '').toUpperCase() // 'INGREDIENT' | 'GROUP'
    if (kind === 'INGREDIENT') {
      const id = String(m.ingredientId || '')
      const attach = ingMap.get(id)
      const def = ingDefMap.get(id)
      if (!attach || !def) continue

      if (def.type === 'BOOLEAN') {
        const v = !!m.value
        if (attach.defaultIncluded && v === false && !attach.removable) continue
        clean.push({ kind:'INGREDIENT', ingredientId: id, key: def.slug, type: def.type, value: v, label: def.name })
      } else if (def.type === 'PERCENT') {
        const n = Number(m.value ?? attach.defaultValue ?? def.defaultValue ?? 0)
        const v = Math.max(def.min ?? 0, Math.min(def.max ?? 100, Number.isFinite(n) ? n : 0))
        clean.push({ kind:'INGREDIENT', ingredientId: id, key: def.slug, type: def.type, value: v, label: def.name })
      } else if (def.type === 'CHOICE') {
        const allowed = (def.choices || []).map(c => c.value)
        const val = allowed.includes(m.value) ? m.value : (attach.defaultValue ?? def.defaultValue ?? null)
        if (val != null) {
          clean.push({ kind:'INGREDIENT', ingredientId: id, key: def.slug, type: def.type, value: val, label: def.name })
        }
      }
    }

    if (kind === 'GROUP') {
      const id = String(m.groupId || '')
      const attach = grpMap.get(id)
      const def = grpDefMap.get(id)
      if (!attach || !def) continue
      const allowed = (def.choices || []).map(c => c.value)
      const val = allowed.includes(m.value) ? m.value : (attach.defaultChoice ?? allowed[0] ?? null)
      if (val != null) clean.push({ kind:'GROUP', groupId: id, key: def.key, type: 'CHOICE', value: val, label: def.name })
    }
  }

  // ensure required groups exist
  for (const [gid, attach] of grpMap) {
    const def = grpDefMap.get(gid)
    if (!def) continue
    const exists = clean.some(x => x.kind === 'GROUP' && x.groupId === gid)
    if (!exists) {
      const allowed = (def.choices || []).map(c => c.value)
      const val = attach.defaultChoice ?? allowed[0] ?? null
      if (def.required && val == null) throw new Error(`Missing required choice: ${def.name}`)
      if (val != null) clean.push({ kind:'GROUP', groupId: gid, key: def.key, type: 'CHOICE', value: val, label: def.name })
    }
  }

  return clean
}

/* ───────────────── controllers ───────────────── */

// GET /orders?status=&type=&groupKey=&q=
async function list (req, res, next) {
  try {
    const { status, type, groupKey, q } = req.query
    const filter = {}

    if (status === 'ACTIVE') filter.status = { $nin: [STATUS.DELIVERED, STATUS.CANCELED] }
    else if (status) filter.status = status
    if (type) filter.type = type
    if (groupKey) filter.groupKey = groupKey
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i')
      filter.$or = [{ groupKey: rx }, { notes: rx }, { 'items.name': rx }]
    }

    const rows = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'customerId', select: 'name' })
      .lean()

    // backfill missing item images (legacy)
    const needFoodIds = new Set(), needPkgIds = new Set()
    for (const o of rows) {
      for (const it of (o.items || [])) {
        if (!it.imageUrl) {
          if (it.kind === 'FOOD' && it.foodId) needFoodIds.add(String(it.foodId))
          if (it.kind === 'PACKAGE' && it.packageId) needPkgIds.add(String(it.packageId))
        }
      }
    }
    let foodMap = new Map(), pkgMap  = new Map()
    if (needFoodIds.size) {
      const foods = await Food.find({ _id: { $in: [...needFoodIds] } }).select('_id imageUrl').lean()
      foodMap = new Map(foods.map(f => [String(f._id), f.imageUrl || '']))
    }
    if (needPkgIds.size) {
      const pkgs = await Package.find({ _id: { $in: [...needPkgIds] } }).select('_id imageUrl').lean()
      pkgMap = new Map(pkgs.map(p => [String(p._id), p.imageUrl || '']))
    }
    for (const o of rows) {
      for (const it of (o.items || [])) {
        if (!it.imageUrl) {
          if (it.kind === 'FOOD' && it.foodId) it.imageUrl = foodMap.get(String(it.foodId)) || ''
          if (it.kind === 'PACKAGE' && it.packageId) it.imageUrl = pkgMap.get(String(it.packageId)) || ''
        }
      }
    }

    res.json(rows.map(serializeOrder))
  } catch (e) { next(e) }
}

// GET /orders/:id
async function getOne (req, res, next) {
  try {
    const row = await Order.findById(req.params.id)
      .populate({ path: 'customerId', select: 'name' })
    if (!row) return res.status(404).json({ message: 'Order not found' })
    res.json(serializeOrder(row))
  } catch (e) { next(e) }
}

// POST /orders  (decrement foods now, store sanitized mods)
async function create (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const authedId = req.user?._id || req.user?.id
    if (!authedId) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    const type = (req.body.type || 'INDIVIDUAL').toUpperCase()
    if (!ORDER_TYPES.includes(type)) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ message: 'Invalid order type' })
    }

    const itemsReq = Array.isArray(req.body.items) ? req.body.items : []
    if (!itemsReq.length) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ message: 'At least one item is required' })
    }

    const prepared = []
    for (const it of itemsReq) {
      const kind = String(it.kind || '').toUpperCase()
      const qty  = Math.max(1, parseInt(it.qty, 10) || 1)

      if (kind === 'FOOD') {
        const f = await Food.findById(it.foodId)
          .populate('ingredients.ingredientId', 'name slug type choices min max step defaultValue')
          .populate('choiceGroups.groupId', 'name key choices required')
          .session(session)
        if (!f) {
          await session.abortTransaction(); session.endSession()
          return res.status(400).json({ message: 'Food not found', id: it.foodId })
        }
        const safeMods = await sanitizeModsForFood(f, Array.isArray(it.mods) ? it.mods : [])
        prepared.push({
          kind: 'FOOD',
          foodId: f._id,
          name: f.name,
          imageUrl: f.imageUrl || '',
          qty,
          unitPrice: 0,
          mods: safeMods
        })
      } else if (kind === 'PACKAGE') {
        const p = await Package.findById(it.packageId).select('_id name imageUrl').session(session)
        if (!p) {
          await session.abortTransaction(); session.endSession()
          return res.status(400).json({ message: 'Package not found', id: it.packageId })
        }
        prepared.push({
          kind: 'PACKAGE',
          packageId: p._id,
          name: p.name,
          imageUrl: p.imageUrl || '',
          qty,
          unitPrice: 0
        })
      } else {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ message: 'Invalid item kind', kind: it.kind })
      }
    }

    // Decrement food stock (expand packages to foods)
    const foodMap = await expandToFoods(itemsReq, session)
    await decrementFoodsStock(session, foodMap)

    const [doc] = await Order.create([{
      type,
      status: STATUS.PLACED,
      customerId: authedId,
      groupKey: type === 'GROUP' && String(req.body.groupKey || '').trim()
        ? String(req.body.groupKey).trim() : null,
      notes: req.body.notes || '',
      items: prepared,
      grandTotal: 0,
      stockCommitted: true, // we decreased at create
      createdBy: authedId,
      updatedBy: authedId,
    }], { session })

    await session.commitTransaction()
    await doc.populate({ path: 'customerId', select: 'name' })

    const order = serializeOrder(doc)
    emitOrder(req, order, 'order:new')
    res.status(201).json(order)
  } catch (e) {
    await session.abortTransaction()
    next(e)
  } finally {
    session.endSession()
  }
}

// PATCH /orders/:id/accept (no stock change)
async function accept (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== STATUS.PLACED) {
      return res.status(400).json({ message: `Order must be ${STATUS.PLACED} before accepting` })
    }
    order.status = STATUS.ACCEPTED
    order.acceptedAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) { next(e) }
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

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
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

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
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

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/cancel  (restore foods if numeric)
async function cancel (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const order = await Order.findById(req.params.id).session(session)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if ([STATUS.DELIVERED, STATUS.CANCELED].includes(order.status)) {
      return res.status(400).json({ message: 'Order already finished' })
    }

    // Expand to foods and restore only numeric stocks
    const foodMap = await expandToFoods(order.items, session)
    await incrementFoodsStock(session, foodMap)

    order.status = STATUS.CANCELED
    order.canceledAt = new Date()
    order.updatedBy = req.user?._id || null
    order.stockCommitted = false
    await order.save({ session })

    await session.commitTransaction()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
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
