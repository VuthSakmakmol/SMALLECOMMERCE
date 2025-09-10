const Food = require('../models/Food')
const Ingredient = require('../models/Ingredient')
const ChoiceGroup = require('../models/ChoiceGroup') // assume you have this

/* ---------- helpers ---------- */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

async function normalizeAttachments({ ingredients = [], choiceGroups = [] }) {
  // Map Ingredients for quick lookup
  const ingIds = [...new Set(ingredients.map(i => String(i.ingredientId)).filter(Boolean))]
  const ingDocs = ingIds.length ? await Ingredient.find({ _id: { $in: ingIds } }).lean() : []
  const ingMap = new Map(ingDocs.map(d => [String(d._id), d]))

  const normalizedIngs = []
  for (const it of ingredients) {
    const def = ingMap.get(String(it.ingredientId))
    if (!def) continue
    const one = {
      ingredientId: it.ingredientId,
      defaultIncluded: !!it.defaultIncluded,
      removable: !!it.removable,
      defaultValue: null
    }
    if (def.type === 'BOOLEAN') {
      // accept boolean or null
      one.defaultValue = typeof it.defaultValue === 'boolean' ? it.defaultValue : null
    } else if (def.type === 'PERCENT') {
      const n = Number(it.defaultValue)
      const min = Number(def.min ?? 0)
      const max = Number(def.max ?? 100)
      one.defaultValue = Number.isFinite(n)
        ? clamp(n, min, max)
        : (typeof def.defaultValue === 'number' ? clamp(def.defaultValue, min, max) : max)
    } else if (def.type === 'CHOICE') {
      const allowed = (def.choices || []).map(c => c.value)
      if (allowed.includes(it.defaultValue)) one.defaultValue = it.defaultValue
      else if (allowed.length) one.defaultValue = allowed[0]
      else one.defaultValue = null
    }
    normalizedIngs.push(one)
  }

  // Choice groups
  const grpIds = [...new Set(choiceGroups.map(g => String(g.groupId)).filter(Boolean))]
  const grpDocs = grpIds.length ? await ChoiceGroup.find({ _id: { $in: grpIds } }).lean() : []
  const grpMap = new Map(grpDocs.map(d => [String(d._id), d]))

  const normalizedGrps = []
  for (const g of choiceGroups) {
    const def = grpMap.get(String(g.groupId))
    if (!def) continue
    const allowed = (def.choices || []).map(c => c.value)
    const required = !!def.required
    let defaultChoice = g.defaultChoice
    if (!allowed.includes(defaultChoice)) {
      defaultChoice = required ? (allowed[0] ?? null) : null
    }
    normalizedGrps.push({ groupId: g.groupId, defaultChoice })
  }

  return { ingredients: normalizedIngs, choiceGroups: normalizedGrps }
}

/* ---------- list ---------- */
// GET /foods?activeOnly=&q=&categoryId=
exports.list = async (req, res, next) => {
  try {
    const { activeOnly, q, categoryId } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActiveGlobal = true
    if (categoryId) filter.categoryId = categoryId
    if (q) {
      const rx = new RegExp(q, 'i')
      filter.$or = [{ name: rx }, { description: rx }, { tags: rx }]
    }

    const rows = await Food
      .find(filter)
      .sort({ updatedAt: -1 })
      .populate('categoryId', 'name') // so your table shows the name
      .lean()

    res.json(rows)
  } catch (e) { next(e) }
}

/* ---------- get one ---------- */
exports.getOne = async (req, res, next) => {
  try {
    const row = await Food.findById(req.params.id)
      .populate('categoryId', 'name')
      .populate('ingredients.ingredientId', 'name type choices min max defaultValue')
      .populate('choiceGroups.groupId', 'name choices required')
      .lean()
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/* ---------- create ---------- */
exports.create = async (req, res, next) => {
  try {
    const base = {
      name: String(req.body.name || '').trim(),
      categoryId: req.body.categoryId,
      imageUrl: req.body.imageUrl || '',
      description: req.body.description || '',
      tags: Array.isArray(req.body.tags) ? req.body.tags : [],
      stockQty: req.body.stockQty ?? null,
      isActiveGlobal: req.body.isActiveGlobal ?? true,
      isActiveKitchen: req.body.isActiveKitchen ?? true,
      createdBy: req.user?.sub || null,
      updatedBy: req.user?.sub || null
    }

    const { ingredients, choiceGroups } = await normalizeAttachments({
      ingredients: req.body.ingredients || [],
      choiceGroups: req.body.choiceGroups || []
    })

    const row = await Food.create({ ...base, ingredients, choiceGroups })
    const populated = await Food.findById(row._id).populate('categoryId', 'name').lean()
    res.status(201).json(populated)
  } catch (e) { next(e) }
}

/* ---------- update ---------- */
exports.update = async (req, res, next) => {
  try {
    const upd = {}
    ;['name','categoryId','imageUrl','description','tags','stockQty','isActiveGlobal','isActiveKitchen']
      .forEach(k => { if (req.body[k] !== undefined) upd[k] = req.body[k] })
    upd.updatedBy = req.user?.sub || null

    if (req.body.ingredients !== undefined || req.body.choiceGroups !== undefined) {
      const norm = await normalizeAttachments({
        ingredients: req.body.ingredients || [],
        choiceGroups: req.body.choiceGroups || []
      })
      upd.ingredients = norm.ingredients
      upd.choiceGroups = norm.choiceGroups
    }

    const row = await Food.findByIdAndUpdate(req.params.id, upd, { new: true, runValidators: true })
      .populate('categoryId', 'name')
      .lean()
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/* ---------- toggle scopes ---------- */
// PATCH /foods/:id/toggle { scope: 'GLOBAL'|'KITCHEN', value: boolean }
exports.toggle = async (req, res, next) => {
  try {
    const { scope, value } = req.body
    const patch = {}
    if (scope === 'GLOBAL') patch.isActiveGlobal = !!value
    else if (scope === 'KITCHEN') patch.isActiveKitchen = !!value
    else return res.status(400).json({ message: 'Invalid scope' })

    patch.updatedBy = req.user?.sub || null

    const row = await Food.findByIdAndUpdate(req.params.id, patch, { new: true })
      .populate('categoryId', 'name')
      .lean()
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/* ---------- stock ---------- */
// PATCH /foods/:id/stock { stockQty: number|null }
exports.setStock = async (req, res, next) => {
  try {
    const stockQty = req.body.stockQty === null ? null : Math.max(0, parseInt(req.body.stockQty, 10) || 0)
    const row = await Food.findByIdAndUpdate(req.params.id, { stockQty, updatedBy: req.user?.sub || null }, { new: true })
      .populate('categoryId', 'name')
      .lean()
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/* ---------- delete ---------- */
exports.remove = async (req, res, next) => {
  try {
    const row = await Food.findByIdAndDelete(req.params.id)
    if (!row) return res.status(404).json({ message: 'Food not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}
