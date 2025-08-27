// server/src/controllers/orders.controller.js
const dayjs = require('dayjs')
const Order = require('../models/Order')
const Food = require('../models/Food')
const Package = require('../models/Package')

// statuses used by your routes/UI
const STATUS = {
  PLACED: 'PLACED',
  ACCEPTED: 'ACCEPTED',
  COOKING: 'COOKING',
  READY: 'READY',
  DELIVERED: 'DELIVERED',
  CANCELED: 'CANCELED'
}

const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']
const todayStr = () => dayjs().format('YYYY-MM-DD')

/* ───────────────────────────────
   Stock helpers
──────────────────────────────── */
async function applyStockForFood (foodId, qty, { consume = false } = {}) {
  const food = await Food.findById(foodId)
  if (!food) return { ok: false, reason: 'NOT_FOUND' }

  // unlimited
  if (food.dailyLimit == null) return { ok: true }

  // reset if day changed
  if (food.stockDate !== todayStr()) {
    food.stockDate = todayStr()
    food.stockRemaining = food.dailyLimit
  }

  if ((food.stockRemaining ?? 0) < qty) {
    return { ok: false, reason: 'OUT_OF_STOCK', remaining: food.stockRemaining ?? 0 }
  }

  if (consume) {
    food.stockRemaining -= qty
    await food.save()
  }
  return { ok: true, remaining: food.stockRemaining }
}

async function explodePackage (pkgDoc, qty) {
  // pkg.items: [{ foodId, qty }]
  return (pkgDoc.items || []).map(it => ({
    foodId: it.foodId,
    qtyToConsume: (Number(it.qty) || 0) * (Number(qty) || 0)
  }))
}

function snapshotFoodLine (foodDoc, qty, unitPrice) {
  return {
    kind: 'FOOD',
    foodId: foodDoc._id,
    name: foodDoc.name,
    imageUrl: foodDoc.imageUrl || '',
    qty: Number(qty),
    unitPrice: Number(unitPrice) // NOTE: your Food model has no price; default 0 unless provided
  }
}

function snapshotPackageLine (pkgDoc, qty) {
  return {
    kind: 'PACKAGE',
    packageId: pkgDoc._id,
    name: pkgDoc.name,
    imageUrl: pkgDoc.imageUrl || '',
    qty: Number(qty),
    unitPrice: Number(pkgDoc.price || 0)
  }
}

/* ───────────────────────────────
   Socket helper
──────────────────────────────── */
function emitOrder (req, orderObj, event) {
  const io = req.app.get('io')
  if (!io) return

  io.to('room:chef').emit(event, orderObj)
  io.to('room:admin').emit(event, orderObj)
  if (orderObj.customerId) io.to(`room:customer:${orderObj.customerId}`).emit(event, orderObj)
  io.to(`room:order:${orderObj._id}`).emit(event, orderObj)
  if (orderObj.groupKey) io.to(`room:group:${orderObj.groupKey}`).emit(event, orderObj)
}

/* ───────────────────────────────
   Controllers
──────────────────────────────── */

// GET /orders?status=&type=&groupKey=
async function list (req, res, next) {
  try {
    const { status, type, groupKey } = req.query
    const filter = {}
    if (status) filter.status = status
    if (type) filter.type = type
    if (groupKey) filter.groupKey = groupKey

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

// POST /orders
// body: { type, groupKey?, customerId?, customerName?, phone?, notes?, items:[{ kind:'FOOD'|'PACKAGE', foodId?, packageId?, qty, unitPrice? }] }
async function create (req, res, next) {
  try {
    const {
      type = 'INDIVIDUAL',
      groupKey = null,
      customerId = null,
      customerName = '',
      phone = '',
      notes = '',
      items = []
    } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order requires at least one item' })
    }
    if (!ORDER_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid order type' })
    }

    const lines = []
    const consumptions = []

    for (const it of items) {
      const qty = Number(it.qty || 0)
      if (qty <= 0) return res.status(400).json({ message: 'Invalid qty in items' })

      if (it.kind === 'FOOD') {
        const food = await Food.findById(it.foodId)
        if (!food) return res.status(400).json({ message: 'Food not found' })

        const check = await applyStockForFood(food._id, qty, { consume: false })
        if (!check.ok) {
          return res.status(409).json({ message: `Out of stock for ${food.name}`, remaining: check.remaining })
        }

        const unitPrice = it.unitPrice != null ? Number(it.unitPrice) : Number(food.price || 0)
        lines.push(snapshotFoodLine(food, qty, unitPrice))
        consumptions.push({ foodId: food._id, qty })
      } else if (it.kind === 'PACKAGE') {
        const pkg = await Package.findById(it.packageId)
        if (!pkg || pkg.isActive === false) {
          return res.status(400).json({ message: 'Package not found or inactive' })
        }
        const parts = await explodePackage(pkg, qty)
        for (const p of parts) {
          const ok = await applyStockForFood(p.foodId, p.qtyToConsume, { consume: false })
          if (!ok.ok) {
            const f = await Food.findById(p.foodId).lean()
            return res.status(409).json({ message: `Out of stock for ${f?.name || 'item in package'}`, remaining: ok.remaining })
          }
        }
        lines.push(snapshotPackageLine(pkg, qty))
        consumptions.push(...parts.map(p => ({ foodId: p.foodId, qty: p.qtyToConsume })))
      } else {
        return res.status(400).json({ message: 'Invalid item kind (must be FOOD or PACKAGE)' })
      }
    }

    // totals
    const subtotal = lines.reduce((s, l) => s + Number(l.unitPrice) * Number(l.qty), 0)
    const discount = 0
    const serviceFee = 0
    const grandTotal = subtotal - discount + serviceFee

    // create order
    const order = await Order.create({
      type,
      groupKey,
      customerId,
      customerName,
      phone,
      items: lines,
      notes,
      subtotal,
      discount,
      serviceFee,
      grandTotal,
      status: STATUS.PLACED,
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null
    })

    // consume stock
    for (const c of consumptions) {
      const r = await applyStockForFood(c.foodId, c.qty, { consume: true })
      if (!r.ok) {
        order.status = STATUS.CANCELED
        order.canceledAt = new Date()
        await order.save()
        return res.status(409).json({ message: 'Stock race condition, order auto-canceled' })
      }
    }

    emitOrder(req, order.toObject(), 'order:new')
    res.status(201).json(order)
  } catch (e) { next(e) }
}

/* ───────────────────────────────
   Status transitions
──────────────────────────────── */
// PATCH /orders/:id/accept
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
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
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
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/ready
async function ready (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== STATUS.COOKING && order.status !== STATUS.ACCEPTED) {
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
    order.status = STATUS.DELIVERED
    order.deliveredAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/cancel
async function cancel (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if ([STATUS.DELIVERED, STATUS.CANCELED].includes(order.status)) {
      return res.status(400).json({ message: 'Order already finished' })
    }
    order.status = STATUS.CANCELED
    order.canceledAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()
    emitOrder(req, order.toObject(), 'order:status')
    res.json(order)
  } catch (e) { next(e) }
}

module.exports = {
  list,
  getOne,
  create,
  accept,
  start,
  ready,
  deliver,
  cancel
}
