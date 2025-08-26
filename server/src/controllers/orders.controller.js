const dayjs = require('dayjs')
const Order = require('../models/Order')
const Food = require('../models/Food')
const { notifyAdmin, notifyChefs } = require('../services/telegram')

// helper
const pushTL = (order, status, byUserId, note) => {
  order.timeline.push({ status, at: new Date(), byUserId, note })
}

// helper
function emitUpdate(io, order) {
  const payload = { orderId: order._id.toString(), status: order.status } // ← string!
  io?.to('room:admin').emit('orders:update', payload)
  if (order.kitchenId) io?.to(`room:chef:${order.kitchenId}`).emit('orders:update', payload)
  if (order.customerId) io?.to(`room:customer:${order.customerId}`).emit('orders:update', payload)
  io?.to(`room:order:${order._id}`).emit('orders:update', payload) // optional room
}

// GET /api/orders?scope=ADMIN|CHEF|CUSTOMER&status=...
const list = async (req, res, next) => {
  try {
    const { scope, status } = req.query
    const filter = {}
    if (status) filter.status = status

    if (scope === 'CHEF' && req.user?.kitchenId) {
      filter.kitchenId = req.user.kitchenId
    } else if (scope === 'CUSTOMER') {
      filter.customerId = req.user._id
    }
    const rows = await Order.find(filter).sort({ createdAt: -1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

// POST /api/orders  { items:[{foodId, qty, preferences?}], kitchenId? }
const create = async (req, res, next) => {
  try {
    const { items = [], kitchenId = null } = req.body
    if (!items.length) return res.status(400).json({ message: 'Empty items' })

    const today = dayjs().format('YYYY-MM-DD')
    const foods = await Food.find({ _id: { $in: items.map(i => i.foodId) }, isActiveGlobal: true, isActiveKitchen: true })
    const byId = new Map(foods.map(f => [String(f._id), f]))

    // check and decrement stock
    for (const it of items) {
      const f = byId.get(String(it.foodId))
      if (!f) return res.status(400).json({ message: 'Food not available', foodId: it.foodId })
      const qty = it.qty || 1
      if (f.dailyLimit !== null) {
        if (f.stockDate !== today) {
          f.stockDate = today
          f.stockRemaining = f.dailyLimit
        }
        if (f.stockRemaining < qty) {
          return res.status(400).json({ message: 'Out of stock', foodId: f._id, remaining: f.stockRemaining })
        }
      }
    }
    for (const it of items) {
      const f = byId.get(String(it.foodId))
      const qty = it.qty || 1
      if (f.dailyLimit !== null) {
        f.stockRemaining -= qty
        await f.save()
      }
    }

    const order = new Order({
      customerId: req.user?.role === 'CUSTOMER' ? req.user._id : null,
      kitchenId,
      items: items.map(it => {
        const f = byId.get(String(it.foodId))
        return {
          foodId: f._id,
          nameSnapshot: f.name,
          qty: it.qty || 1,
          preferences: it.preferences || {}
        }
      }),
      status: 'PENDING',
      timeline: []
    })
    pushTL(order, 'PENDING', req.user?._id || null, 'Created')
    await order.save()

    const io = req.app.get('io')
    // sockets
    io?.to('room:admin').emit('orders:new', order)
    if (order.kitchenId) io?.to(`room:chef:${order.kitchenId}`).emit('orders:new', order)
    if (order.customerId) io?.to(`room:customer:${order.customerId}`).emit('orders:new', order)
    // customer can also join a dedicated room if you want
    // (front-end will listen to 'orders:update' anyway)
    // io?.socketsJoin?.(`room:order:${order._id}`)

    // Telegram
    const summary = order.items.map(i => `${i.qty}× ${i.nameSnapshot}`).join(', ')
    await notifyAdmin(`🍽️ <b>New order</b> #${order._id}\nItems: ${summary}`)
    await notifyChefs(`🍽️ New order #${order._id}\nItems: ${summary}`, order.kitchenId)

    res.status(201).json(order)
  } catch (e) { next(e) }
}

const transition = (next) => async (req, res, nextFn) => {
  try {
    const { id } = req.params
    const order = await Order.findById(id)
    if (!order) return res.status(404).json({ message: 'Order not found' })

    const flow = {
      accept: { from: ['PENDING'], to: 'ACCEPTED', label: 'accepted' },
      start:  { from: ['ACCEPTED'], to: 'COOKING', label: 'started cooking' },
      ready:  { from: ['COOKING'], to: 'READY',   label: 'ready' },
      deliver:{ from: ['READY'],    to: 'DELIVERED',label: 'delivered' }
    }[next]

    if (!flow.from.includes(order.status))
      return res.status(400).json({ message: `Cannot ${next} from ${order.status}` })

    // permissions: chef/admin; for deliver allow customer if owns it
    const role = req.user.role
    if (next === 'deliver' && role === 'CUSTOMER') {
      if (String(order.customerId) !== String(req.user._id)) {
        return res.status(403).json({ message: 'Not your order' })
      }
    } else if (!['CHEF','ADMIN'].includes(role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    order.status = flow.to
    pushTL(order, flow.to, req.user._id, flow.label)
    await order.save()

    const io = req.app.get('io')
    emitUpdate(io, order)

    // Telegram notes to admin
    await notifyAdmin(`🧑‍🍳 Order #${order._id} ${flow.label}.`)
    res.json(order)
  } catch (e) { nextFn(e) }
}

const getOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const o = await Order.findById(id).lean()
    if (!o) return res.status(404).json({ message: 'Order not found' })
    // auth: admin, chef in same kitchen, or owner customer
    if (req.user.role === 'CUSTOMER' && String(o.customerId) !== String(req.user._id)) return res.status(403).json({ message: 'Forbidden' })
    if (req.user.role === 'CHEF' && o.kitchenId && req.user.kitchenId !== o.kitchenId) return res.status(403).json({ message: 'Forbidden' })
    res.json(o)
  } catch (e) { next(e) }
}



module.exports = {
  list,
  create,
  accept:  transition('accept'),
  start:   transition('start'),
  ready:   transition('ready'),
  deliver: transition('deliver'),
  getOne
}
