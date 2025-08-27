const Category = require('../models/Category')
const Food = require('../models/Food')

// local slugify for updates via findByIdAndUpdate
const toSlug = (s) =>
  String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

/** GET /categories?activeOnly=true&q=khmer */
const list = async (req, res, next) => {
  try {
    const { activeOnly, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
    if (q) filter.name = { $regex: q, $options: 'i' }

    const rows = await Category.find(filter).sort({ name: 1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

/** GET /categories/:id */
const getOne = async (req, res, next) => {
  try {
    const row = await Category.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** POST /categories   body: { name } */
const create = async (req, res, next) => {
  try {
    const { name } = req.body

    // case-insensitive uniqueness by name
    const exists = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') })
    if (exists) return res.status(409).json({ message: 'Category already exists' })

    const row = await Category.create({ name })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

/** PUT /categories/:id   body: { name?, isActive? } */
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name', 'isActive'].forEach(k => {
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })
    if (payload.name) payload.slug = toSlug(payload.name)

    // enforce case-insensitive uniqueness on name
    if (payload.name) {
      const dup = await Category.findOne({
        _id: { $ne: id },
        name: new RegExp(`^${payload.name}$`, 'i')
      }).lean()
      if (dup) return res.status(409).json({ message: 'Category name already in use' })
    }

    const row = await Category.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** PATCH /categories/:id/toggle   body: { value: boolean } */
const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { value } = req.body
    const row = await Category.findByIdAndUpdate(id, { isActive: !!value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** DELETE /categories/:id   blocks if foods exist under the category */
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

module.exports = { list, getOne, create, update, toggle, removeOne }
