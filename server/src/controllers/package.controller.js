const Package = require('../models/Package')
const Food = require('../models/Food')

const ALLOWED_NAMES = ['Individual', 'Group', 'Workshop']

// GET /api/packages?activeOnly=true&inStockOnly=true&q=...
const list = async (req, res, next) => {
  try {
    const { activeOnly, inStockOnly, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
    if (String(inStockOnly) === 'true') filter.availableQty = { $gt: 0 }
    if (q) filter.name = { $regex: q, $options: 'i' }

    const rows = await Package.find(filter).sort({ name: 1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

// GET /api/packages/:id
const getOne = async (req, res, next) => {
  try {
    const row = await Package.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// POST /api/packages  { name, items:[{foodId,qty}], description?, imageUrl?, availableQty? }
const create = async (req, res, next) => {
  try {
    const { name, imageUrl = '', description = '', items = [], availableQty = null } = req.body

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

    const row = await Package.create({ name, items, description, imageUrl, availableQty })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

// PUT /api/packages/:id
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name','imageUrl','description','items','isActive','availableQty'].forEach(k => {
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

// PATCH /api/packages/:id/toggle
const toggle = async (req, res, next) => {
  try {
    const row = await Package.findByIdAndUpdate(
      req.params.id, { isActive: !!req.body.value }, { new: true }
    )
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// DELETE /api/packages/:id
const removeOne = async (req, res, next) => {
  try {
    const row = await Package.findByIdAndDelete(req.params.id)
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/** PATCH /api/packages/:id/stock
 * body: { availableQty: number|null }
 * Static stock display (null = not tracked / unlimited label).
 */
const setStock = async (req, res, next) => {
  try {
    const { id } = req.params
    const { availableQty } = req.body

    const update = { availableQty: availableQty === null ? null : Number(availableQty) }
    if (update.availableQty !== null && (!Number.isInteger(update.availableQty) || update.availableQty < 0)) {
      return res.status(400).json({ message: 'availableQty must be null or an integer >= 0' })
    }

    const row = await Package.findByIdAndUpdate(id, update, { new: true })
    if (!row) return res.status(404).json({ message: 'Package not found' })
    res.json(row)
  } catch (e) { next(e) }
}

module.exports = { list, getOne, create, update, toggle, removeOne, setStock }
