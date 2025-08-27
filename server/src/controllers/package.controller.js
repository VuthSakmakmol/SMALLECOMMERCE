const Package = require('../models/Package')
const Food = require('../models/Food')

// GET /api/packages?activeOnly=true&q=...
const list = async (req, res, next) => {
  try {
    const { activeOnly, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
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

// POST /api/packages  { name, items:[{foodId,qty}], price, description?, imageUrl? }
const create = async (req, res, next) => {
  try {
    const { name, items = [], price, description = '', imageUrl = '' } = req.body
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Package must contain at least one item' })
    }

    const foodIds = items.map(i => i.foodId)
    const count = await Food.countDocuments({ _id: { $in: foodIds } })
    if (count !== items.length) {
      return res.status(400).json({ message: 'Some foods not found for this package' })
    }

    const row = await Package.create({ name, items, price, description, imageUrl })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name','items','price','description','imageUrl','isActive'].forEach(k=>{
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })
    if (payload.items) {
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

module.exports = { list, getOne, create, update, toggle, removeOne }
