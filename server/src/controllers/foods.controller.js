const Food = require('../models/Food')

/** GET /api/foods?activeOnly=true&categoryId=...&q=... */
const list = async (req, res, next) => {
  try {
    const { activeOnly, categoryId, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') {
      filter.isActiveGlobal = true
      filter.isActiveKitchen = true
    }
    if (categoryId) filter.categoryId = categoryId
    if (q) filter.name = { $regex: q, $options: 'i' }

    const rows = await Food.find(filter).populate('categoryId', 'name slug').sort({ createdAt: -1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

/** POST /api/foods (ADMIN) body: { name, categoryId, imageUrl?, description?, tags? } */
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
    const io = req.app.get('io')
    io?.to('room:admin').emit('foods:update', { type: 'create', food: row })
    res.status(201).json(row)
  } catch (e) { next(e) }
}

/** PUT /api/foods/:id (ADMIN) */
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = { ...req.body, updatedBy: req.user?._id || null }
    const row = await Food.findByIdAndUpdate(id, payload, { new: true })
    if (!row) return res.status(404).json({ message: 'Food not found' })
    const io = req.app.get('io')
    io?.to('room:admin').emit('foods:update', { type: 'update', food: row })
    res.json(row)
  } catch (e) { next(e) }
}

/** DELETE /api/foods/:id (ADMIN) */
const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const row = await Food.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ message: 'Food not found' })
    const io = req.app.get('io')
    io?.to('room:admin').emit('foods:update', { type: 'delete', foodId: id })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/** PATCH /api/foods/:id/toggle (ADMIN or CHEF) body: { scope: 'GLOBAL'|'KITCHEN', value: boolean } */
const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { scope, value } = req.body
    if (!['GLOBAL', 'KITCHEN'].includes(scope)) {
      return res.status(400).json({ message: 'Invalid scope' })
    }
    const field = scope === 'GLOBAL' ? 'isActiveGlobal' : 'isActiveKitchen'
    const row = await Food.findByIdAndUpdate(id, { [field]: !!value, updatedBy: req.user?._id || null }, { new: true })
    if (!row) return res.status(404).json({ message: 'Food not found' })
    const io = req.app.get('io')
    io?.emit('foods:update', { type: 'toggle', food: row })
    res.json(row)
  } catch (e) { next(e) }
}

module.exports = { list, create, update, removeOne, toggle }
