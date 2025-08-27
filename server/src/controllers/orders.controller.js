// server/src/controllers/orders.controller.js
const dayjs   = require('dayjs')
const Order   = require('../models/Order')
const Food    = require('../models/Food')
const Package = require('../models/Package')

/* ───────────────────────────────
   Constants
──────────────────────────────── */
const STATUS = {
  PLACED:    'PLACED',
  ACCEPTED:  'ACCEPTED',
  COOKING:   'COOKING',
  READY:     'READY',
  DELIVERED: 'DELIVERED',
  CANCELED:  'CANCELED',
}

const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']

/* ───────────────────────────────
   Socket helper (optional)
──────────────────────────────── */
function emitOrder (req, orderObj, event) {
  const io = req.app.get('io')
  if (!io) return
  io.to('room:admin').emit(event, orderObj)
  io.to('room:chef:default').emit(event, orderObj)   // matches your join('room:chef:${kitchenId||default}')
  if (orderObj.customerId) {
    io.to(`room:customer:${orderObj.customerId}`).emit(event, orderObj)
  }
  io.to(`room:order:${orderObj._id}`).emit(event, orderObj)
}

/* ───────────────────────────────
   Controllers
──────────────────────────────── */

// GET /orders?status=&type=&groupKey=&q=
async function list (req, res, next) {
  try {
    const { status, type, groupKey, q } = req.query
    const filter = {}

    // ACTIVE = anything not finished
    if (status === 'ACTIVE') {
      filter.status = { $nin: [STATUS.DELIVERED, STATUS.CANCELED] }
    } else if (status) {
      filter.status = status
    }

    if (type) filter.type = type
    if (groupKey) filter.groupKey = groupKey

    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i')
      filter.$or = [
        { groupKey: rx },
        { notes: rx },
        { 'items.name': rx },
      ]
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

// POST /orders
// body: { type?, groupKey?, notes?, items:[{kind:'FOOD'|'PACKAGE', foodId?, packageId?, qty}] }
async function create (req, res, next) {
  try {
    const authedId = req.user?._id || req.user?.id
    if (!authedId) return res.status(401).json({ message: 'Unauthenticated' })

    const type = (req.body.type || 'INDIVIDUAL').toUpperCase()
    if (!ORDER_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid order type' })
    }

    const items = Array.isArray(req.body.items) ? req.body.items : []
    if (!items.length) return res.status(400).json({ message: 'At least one item is required' })

    // Normalize + validate items; snapshot names so lists are stable
    const prepared = []
    for (const it of items) {
      const kind = String(it.kind || '').toUpperCase()
      const qty  = Math.max(1, parseInt(it.qty, 10) || 1)

      if (kind === 'FOOD') {
        if (!it.foodId) return res.status(400).json({ message: 'foodId is required for FOOD item' })
        const f = await Food.findById(it.foodId).select('_id name')
        if (!f) return res.status(400).json({ message: 'Food not found', id: it.foodId })
        prepared.push({ kind: 'FOOD', foodId: f._id, name: f.name, qty, unitPrice: 0 })
      } else if (kind === 'PACKAGE') {
        if (!it.packageId) return res.status(400).json({ message: 'packageId is required for PACKAGE item' })
        const p = await Package.findById(it.packageId).select('_id name')
        if (!p) return res.status(400).json({ message: 'Package not found', id: it.packageId })
        prepared.push({ kind: 'PACKAGE', packageId: p._id, name: p.name, qty, unitPrice: 0 })
      } else {
        return res.status(400).json({ message: 'Invalid item kind', kind: it.kind })
      }
    }

    const doc = await Order.create({
      type,
      status: STATUS.PLACED,                         // IMPORTANT: Chef/Admin expect this
      customerId: authedId,
      groupKey: type === 'GROUP' ? (req.body.groupKey || null) : null,
      notes: req.body.notes || '',
      items: prepared,
      grandTotal: 0,                                 // free mode
      createdBy: authedId,
      updatedBy: authedId,
    })

    const order = doc.toObject()
    emitOrder(req, order, 'order:new')
    res.status(201).json(order)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/accept (CHEF/ADMIN)
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

// PATCH /orders/:id/start (CHEF/ADMIN)
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

// PATCH /orders/:id/ready (CHEF/ADMIN)
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

// PATCH /orders/:id/deliver (any authed; customers only their own)
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

// PATCH /orders/:id/cancel (CHEF/ADMIN)
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
  cancel,
}
