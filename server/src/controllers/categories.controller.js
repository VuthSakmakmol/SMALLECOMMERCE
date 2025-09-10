const Category = require('../models/Category')
const Food = require('../models/Food') // ensure your Food model has categoryId
const { toSlug } = require('../models/Category')

// GET /categories?activeOnly=true&q=khmer&page=1&limit=50
const list = async (req, res, next) => {
  try {
    const { activeOnly, q, page = 1, limit = 100 } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { slug: new RegExp(q, 'i') }]

    const skip = (Number(page) - 1) * Number(limit)
    const [rows, total] = await Promise.all([
      Category.find(filter).sort({ name: 1 }).skip(skip).limit(Number(limit)).lean(),
      Category.countDocuments(filter)
    ])
    res.json({ data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (e) { next(e) }
}

// GET /categories/:id
const getOne = async (req, res, next) => {
  try {
    const row = await Category.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// GET /categories/slug/:slug
const getBySlug = async (req, res, next) => {
  try {
    const row = await Category.findOne({ slug: req.params.slug }).lean()
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// POST /categories   { name }
const create = async (req, res, next) => {
  try {
    const name = String(req.body.name ?? '').trim()
    if (!name) return res.status(400).json({ message: 'Name required' })
    const row = await Category.create({ name })
    res.status(201).json(row)
  } catch (e) {
    // handle duplicate key (slug or nameNorm)
    if (e?.code === 11000) {
      return res.status(409).json({ message: 'Category already exists' })
    }
    next(e)
  }
}

// PUT /categories/:id   { name?, isActive? }
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name) return res.status(400).json({ message: 'Name cannot be empty' })
      payload.name = name
      payload.slug = toSlug(name)
      payload.nameNorm = name.toLowerCase().trim().replace(/\s+/g, ' ')
    }
    if (req.body.isActive !== undefined) payload.isActive = !!req.body.isActive

    const row = await Category.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: 'Category name already in use' })
    }
    next(e)
  }
}

// PATCH /categories/:id/toggle   { value: boolean }
const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { value } = req.body
    const row = await Category.findByIdAndUpdate(id, { isActive: !!value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

// DELETE /categories/:id   (block if foods exist)
const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const foodCount = await Food.countDocuments({ categoryId: id })
    if (foodCount > 0) {
      return res.status(400).json({ message: 'Cannot delete; category has foods', foodCount })
    }
    const row = await Category.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { list, getOne, getBySlug, create, update, toggle, removeOne }
