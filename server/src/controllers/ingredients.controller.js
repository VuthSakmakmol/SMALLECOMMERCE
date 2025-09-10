// controllers/ingredients.controller.js
const slugify = require('slugify')
const Ingredient = require('../models/Ingredient')
const Food = require('../models/Food')

const makeSlug = (name) => slugify(String(name || ''), { lower: true, strict: true })

/** GET /ingredients?activeOnly=&q= */
const list = async (req, res, next) => {
  try {
    const { activeOnly, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
    if (q) {
      const rx = new RegExp(q, 'i')
      filter.$or = [{ name: rx }, { slug: rx }]
    }
    const rows = await Ingredient.find(filter).sort({ name: 1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

/** GET /ingredients/:id */
const getOne = async (req, res, next) => {
  try {
    const row = await Ingredient.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Ingredient not found' })
    res.json(row)
  } catch (e) { next(e) }
}



/** POST /ingredients */
const create = async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim()
    const slug = (req.body.slug && String(req.body.slug).trim()) || makeSlug(name)

    const payload = {
      name,
      slug,
      type: req.body.type,
      choices: Array.isArray(req.body.choices) ? req.body.choices : [],
      min: req.body.min ?? 0,
      max: req.body.max ?? 100,
      step: req.body.step ?? 25,
      defaultValue: req.body.defaultValue ?? null,
      allergen: !!req.body.allergen,
    }

    // uniqueness
    const dup = await Ingredient.findOne({ $or: [{ name: payload.name }, { slug: payload.slug }] })
    if (dup) return res.status(409).json({ message: 'Name or slug already exists' })

    const row = await Ingredient.create(payload)
    return res.status(201).json(row)
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: 'Name or slug already exists' })
    }
    next(e)
  }
}

/** PUT /ingredients/:id */
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name','slug','type','choices','min','max','step','defaultValue','allergen','isActive']
      .forEach(k => { if (req.body[k] !== undefined) payload[k] = req.body[k] })

    // If name updated but slug not provided, regenerate slug automatically
    if (payload.name && payload.slug === undefined) {
      payload.slug = makeSlug(payload.name)
    }

    // uniqueness
    if (payload.name || payload.slug) {
      const cond = { _id: { $ne: id }, $or: [] }
      if (payload.name) cond.$or.push({ name: payload.name })
      if (payload.slug) cond.$or.push({ slug: payload.slug })
      if (cond.$or.length) {
        const dup = await Ingredient.findOne(cond)
        if (dup) return res.status(409).json({ message: 'Name or slug already in use' })
      }
    }

    const row = await Ingredient.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Ingredient not found' })
    res.json(row)
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: 'Name or slug already in use' })
    }
    next(e)
  }
}



/** PATCH /ingredients/:id/toggle */
const toggle = async (req, res, next) => {
  try {
    const row = await Ingredient.findByIdAndUpdate(req.params.id, { isActive: !!req.body.value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Ingredient not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** DELETE /ingredients/:id — block if referenced by food */
const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const inUse = await Food.countDocuments({ 'ingredients.ingredientId': id })
    if (inUse > 0) return res.status(400).json({ message: 'Cannot delete; ingredient is used by foods', inUse })
    const row = await Ingredient.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ message: 'Ingredient not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { list, getOne, create, update, toggle, removeOne }

