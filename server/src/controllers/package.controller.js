// server/src/controllers/package.controller.js
const dayjs = require('dayjs')
const Package = require('../models/Package')
const Food = require('../models/Food')

const ALLOWED_NAMES = ['Individual', 'Group', 'Workshop']

// GET /api/packages?activeOnly=true&q=...
// When activeOnly=true: also hide zero-stock packages (if dailyLimit is used)
const list = async (req, res, next) => {
  try {
    const { activeOnly, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') {
      filter.isActive = true
      filter.$or = [{ dailyLimit: null }, { stockRemaining: { $gt: 0 } }]
    }
    if (q) filter.name = { $regex: q, $options: 'i' }

    const rows = await Package.find(filter).sort({ name: 1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

const getOne = async (req, res, next) => {
  try {
    const row = await Package.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// POST /api/packages  { name, items:[{foodId,qty}], description?, imageUrl? }
const create = async (req, res, next) => {
  try {
    const { name, imageUrl = '', description = '', items = [] } = req.body

    if (!ALLOWED_NAMES.includes(name)) {
      return res.status(400).json({ message: 'Package name must be Individual, Group, or Workshop' })
    }

    // prevent duplicate type
    const exists = await Package.findOne({ name })
    if (exists) return res.status(400).json({ message: `${name} package already exists` })

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Package must contain at least one item' })
    }

    const foodIds = items.map(i => i.foodId)
    const count = await Food.countDocuments({ _id: { $in: foodIds } })
    if (count !== items.length) {
      return res.status(400).json({ message: 'Some foods not found for this package' })
    }

    const row = await Package.create({ name, items, description, imageUrl })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name','imageUrl','description','items','isActive','dailyLimit','stockDate','stockRemaining'].forEach(k => {
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })

    if (payload.name && !ALLOWED_NAMES.includes(payload.name)) {
      return res.status(400).json({ message: 'Invalid package name' })
    }
    if (payload.name) {
      const taken = await Package.findOne({ name: payload.name, _id: { $ne: id } })
      if (taken) return res.status(400).json({ message: `${payload.name} package already exists` })
    }

    if (payload.items) {
      if (!Array.isArray(payload.items) || payload.items.length === 0) {
        return res.status(400).json({ message: 'Package must contain at least one item' })
      }
      const foodIds = payload.items.map(i => i.foodId)
      const count = await Food.countDocuments({ _id: { $in: foodIds } })
      if (count !== payload.items.length) {
        return res.status(400).json({ message: 'Some foods not found for this package' })
      }
    }

    const row = await Package.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

const toggle = async (req, res, next) => {
  try {
    const row = await Package.findByIdAndUpdate(
      req.params.id, { isActive: !!req.body.value }, { new: true }
    )
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

const removeOne = async (req, res, next) => {
  try {
    const row = await Package.findByIdAndDelete(req.params.id)
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/** PATCH /api/packages/:id/stock  (ADMIN | CHEF)
 * body: { dailyLimit: number|null }
 * Set today's package stock (resets remaining). Null = unlimited.
 */
const setStock = async (req, res, next) => {
  try {
    const { id } = req.params
    const { dailyLimit } = req.body
    const today = dayjs().format('YYYY-MM-DD')

    const update = { dailyLimit: dailyLimit === null ? null : Number(dailyLimit) }
    if (update.dailyLimit === null) {
      update.stockDate = null
      update.stockRemaining = null
    } else {
      update.stockDate = today
      update.stockRemaining = update.dailyLimit
    }
    const row = await Package.findByIdAndUpdate(id, update, { new: true })
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** OPTIONAL: Ensure the 3 package shells exist */
const ensureDefaultPackages = async () => {
  for (const name of ALLOWED_NAMES) {
    const exists = await Package.findOne({ name }).lean()
    if (!exists) await Package.create({ name, items: [], isActive: true })
  }
}

module.exports = { list, getOne, create, update, toggle, removeOne, setStock, ensureDefaultPackages }
