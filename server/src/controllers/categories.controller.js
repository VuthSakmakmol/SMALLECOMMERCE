const Category = require('../models/Category')
const Food = require('../models/Food')

// local slugify helper (for updates via findByIdAndUpdate)
const toSlug = (s) =>
  String(s || '').toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')

/** GET /api/categories?activeOnly=true&q=khmer&parentId=... */
const list = async (req, res, next) => {
  try {
    const { activeOnly, q, parentId } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
    if (q) filter.name = { $regex: q, $options: 'i' }
    if (parentId) filter.parentId = parentId === 'null' ? null : parentId

    const rows = await Category.find(filter)
      .sort({ order: 1, name: 1 })
      .lean()
    res.json(rows)
  } catch (e) { next(e) }
}

/** GET /api/categories/:id */
const getOne = async (req, res, next) => {
  try {
    const row = await Category.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** POST /api/categories   body: { name, parentId?, order? } */
const create = async (req, res, next) => {
  try {
    const { name, parentId = null } = req.body

    // case-insensitive uniqueness by name
    const exists = await Category.findOne({ name: new RegExp(`^${name}$`, 'i') })
    if (exists) return res.status(409).json({ message: 'Category already exists' })

    // auto-assign order if not provided
    let order = req.body.order
    if (order === undefined) {
      const last = await Category.findOne({}).sort({ order: -1 }).lean()
      order = (last?.order ?? 0) + 1
    }

    const row = await Category.create({ name, parentId, order })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

/** PUT /api/categories/:id   body: { name?, parentId?, order?, isActive? } */
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name', 'parentId', 'order', 'isActive'].forEach(k => {
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })
    if (payload.name) payload.slug = toSlug(payload.name)

    // if changing name, enforce case-insensitive uniqueness
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

/** PATCH /api/categories/:id/toggle   body: { value: boolean } */
const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { value } = req.body
    const row = await Category.findByIdAndUpdate(id, { isActive: !!value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Category not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** DELETE /api/categories/:id   blocks if foods exist under the category */
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
