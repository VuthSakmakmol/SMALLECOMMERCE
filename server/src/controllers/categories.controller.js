const Category = require('../models/Category')

const list = async (req, res, next) => {
  try {
    const { activeOnly } = req.query
    const filter = String(activeOnly) === 'true' ? { isActive: true } : {}
    const rows = await Category.find(filter).sort({ order: 1, name: 1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

const create = async (req, res, next) => {
  try {
    const { name, parentId = null, order = 0 } = req.body
    const row = await Category.create({ name, parentId, order })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = { ...req.body }
    const row = await Category.findByIdAndUpdate(id, payload, { new: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    // Optional: block delete if foods exist under it (do later if you want)
    const row = await Category.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { value } = req.body
    const row = await Category.findByIdAndUpdate(id, { isActive: !!value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

module.exports = { list, create, update, removeOne, toggle }
