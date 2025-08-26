const dayjs = require('dayjs')
const Food = require('../models/Food')

/** GET /api/foods?activeOnly=true&categoryId=...&q=... */
const list = async (req, res, next) => {
  try {
    const { activeOnly, categoryId, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') {
      filter.isActiveGlobal = true
      filter.isActiveKitchen = true
      // also hide zero stock when using daily limit
      filter.$or = [{ dailyLimit: null }, { stockRemaining: { $gt: 0 } }]
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

/** GET /api/foods/:id */
const getOne = async (req, res, next) => {
  try {
    const row = await Food.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** POST /api/foods (ADMIN | CHEF)
 * body: { name, categoryId, imageUrl?, description?, tags?[] }
 */
const create = async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      categoryId: req.body.categoryId,
      imageUrl: req.body.imageUrl || '',
      description: req.body.description || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      createdBy: req.user?._id || null,
      updatedBy: req.user?._id || null
    }
    const row = await Food.create(payload)
    res.status(201).json(row)
  } catch (e) { next(e) }
}

/** PUT /api/foods/:id (ADMIN | CHEF) */
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = { ...req.body, updatedBy: req.user?._id || null }
    const row = await Food.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** DELETE /api/foods/:id (ADMIN | CHEF) */
const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const row = await Food.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/** PATCH /api/foods/:id/toggle (ADMIN | CHEF)
 * body: { scope: 'GLOBAL'|'KITCHEN', value: boolean }
 */
const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { scope, value } = req.body
    if (!['GLOBAL', 'KITCHEN'].includes(scope)) {
      return res.status(400).json({ message: 'Invalid scope' })
    }
    const field = scope === 'GLOBAL' ? 'isActiveGlobal' : 'isActiveKitchen'
    const row = await Food.findByIdAndUpdate(
      id, { [field]: !!value, updatedBy: req.user?._id || null }, { new: true }
    )
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** PATCH /api/foods/:id/stock (ADMIN | CHEF)
 * body: { dailyLimit: number|null }
 * Sets today's portions (resets remaining). Null = unlimited (removes stock tracking).
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
    const row = await Food.findByIdAndUpdate(id, update, { new: true })
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

module.exports = { list, getOne, create, update, removeOne, toggle, setStock }
