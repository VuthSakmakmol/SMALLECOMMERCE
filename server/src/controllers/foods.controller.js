const Food = require('../models/Food')
const Category = require('../models/Category')

/** GET /api/foods?activeOnly=true&inStockOnly=true&categoryId=...&q=... */
const list = async (req, res, next) => {
  try {
    const { activeOnly, inStockOnly, categoryId, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') {
      filter.isActiveGlobal = true
      filter.isActiveKitchen = true
    }
    if (String(inStockOnly) === 'true') {
      filter.$or = [{ stockQty: null }, { stockQty: { $gt: 0 } }] // null = unlimited, or >0
    }
    if (categoryId) filter.categoryId = categoryId
    if (q) filter.name = { $regex: q, $options: 'i' }

    const rows = await Food.find(filter)
      .populate('categoryId', 'name slug')
      .sort({ createdAt: -1 })
      .lean()

    res.json(rows)
  } catch (e) { next(e) }
}

const getOne = async (req, res, next) => {
  try {
    const row = await Food.findById(req.params.id)
      .populate('categoryId', 'name slug')
      .lean()
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

const create = async (req, res, next) => {
  try {
    const payload = {
      name: String(req.body.name || '').trim(),
      categoryId: req.body.categoryId,
      imageUrl: req.body.imageUrl || '',
      description: req.body.description || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      stockQty: req.body.stockQty ?? null, // null = unlimited
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null,
    }

    const cat = await Category.findById(payload.categoryId).lean()
    if (!cat) return res.status(400).json({ message: 'Invalid categoryId' })

    const row = await Food.create(payload)
    res.status(201).json(row)
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: 'Food name already exists in this category' })
    next(e)
  }
}

const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = { ...req.body, updatedBy: req.user?._id || null }
    if (payload.categoryId) {
      const cat = await Category.findById(payload.categoryId).lean()
      if (!cat) return res.status(400).json({ message: 'Invalid categoryId' })
    }
    if (payload.tags) payload.tags = Array.isArray(payload.tags) ? payload.tags : []
    const row = await Food.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) {
    if (e?.code === 11000) return res.status(409).json({ message: 'Food name already exists in this category' })
    next(e)
  }
}

const removeOne = async (req, res, next) => {
  try {
    const row = await Food.findByIdAndDelete(req.params.id)
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/** PATCH /api/foods/:id/stock  { stockQty: number|null } */
const setStock = async (req, res, next) => {
  try {
    const { id } = req.params
    const { stockQty } = req.body
    const value = stockQty === null ? null : Number(stockQty)
    if (value !== null && (!Number.isInteger(value) || value < 0)) {
      return res.status(400).json({ message: 'stockQty must be null or an integer >= 0' })
    }
    const row = await Food.findByIdAndUpdate(id, { stockQty: value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

module.exports = { list, getOne, create, update, removeOne, setStock }
