// controllers/cart.controller.js
const Cart = require('../models/Cart')
const Food = require('../models/Food')
const Ingredient = require('../models/Ingredient')
const ChoiceGroup = require('../models/ChoiceGroup')

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

function getUserId(req) {
  // Prefer your auth; fallback to a guest header
  return req.user?.sub || req.headers['x-guest-id'] || 'anonymous'
}

// Normalize selections strictly against Food/Ingredient/ChoiceGroup definitions
async function normalizeSelections(food, selIngs = [], selGroups = []) {
  // INGREDIENTS
  const attachIngs = food.ingredients || []
  const ingIds = [...new Set(attachIngs.map(a => String(a.ingredientId)))]
  const ingDefs = ingIds.length ? await Ingredient.find({ _id: { $in: ingIds } }).lean() : []
  const ingDefMap = new Map(ingDefs.map(d => [String(d._id), d]))

  const chosenMap = new Map(selIngs.map(s => [String(s.ingredientId), s]))
  const normIngs = []

  for (const att of attachIngs) {
    const key = String(att.ingredientId)
    const def = ingDefMap.get(key)
    if (!def) continue

    const userSel = chosenMap.get(key) || {}
    // included logic
    let included = userSel.included
    if (included === undefined) included = !!att.defaultIncluded
    if (att.defaultIncluded && att.removable === false) included = true // forced include

    let value = null
    if (def.type === 'PERCENT') {
      if (included) {
        const n = Number(userSel.value)
        const min = Number(def.min ?? 0)
        const max = Number(def.max ?? 100)
        if (Number.isFinite(n)) value = clamp(n, min, max)
        else if (typeof att.defaultValue === 'number') value = clamp(att.defaultValue, min, max)
        else if (typeof def.defaultValue === 'number') value = clamp(def.defaultValue, min, max)
        else value = max
      }
    } else if (def.type === 'CHOICE') {
      if (included) {
        const allowed = (def.choices || []).map(c => c.value)
        if (allowed.includes(userSel.value)) value = userSel.value
        else if (allowed.includes(att.defaultValue)) value = att.defaultValue
        else value = allowed[0] ?? null
      }
    } else {
      // BOOLEAN has no value; keep null
      value = null
    }

    normIngs.push({
      ingredientId: att.ingredientId,
      included: !!included,
      value
    })
  }

  // CHOICE GROUPS
  const attachGrps = food.choiceGroups || []
  const grpIds = [...new Set(attachGrps.map(g => String(g.groupId)))]
  const grpDefs = grpIds.length ? await ChoiceGroup.find({ _id: { $in: grpIds } }).lean() : []
  const grpDefMap = new Map(grpDefs.map(d => [String(d._id), d]))
  const userGrpMap = new Map(selGroups.map(s => [String(s.groupId), s]))

  const normGroups = []
  for (const att of attachGrps) {
    const key = String(att.groupId)
    const def = grpDefMap.get(key)
    if (!def) continue
    const allowed = (def.choices || []).map(c => c.value)
    const required = !!def.required
    const userSel = userGrpMap.get(key)
    let choice = userSel?.choice

    if (!allowed.includes(choice)) {
      // fallback order: food default -> required ? first : null
      if (allowed.includes(att.defaultChoice)) choice = att.defaultChoice
      else choice = required ? (allowed[0] ?? null) : null
    }

    normGroups.push({ groupId: att.groupId, choice })
  }

  return { ingredients: normIngs, groups: normGroups }
}

/* ----------------- Handlers ----------------- */

// GET /cart
exports.getCart = async (req, res, next) => {
  try {
    const userId = getUserId(req)
    const cart = await Cart.findOne({ userId })
      .populate('items.foodId', 'name imageUrl categoryId')
      .populate('items.ingredients.ingredientId', 'name type choices min max')
      .populate('items.groups.groupId', 'name choices required')
      .lean()
    res.json(cart || { userId, items: [] })
  } catch (e) { next(e) }
}

// POST /cart/items  body: { foodId, qty, ingredients?, groups? }
exports.addItem = async (req, res, next) => {
  try {
    const userId = getUserId(req)
    const qty = Math.max(1, parseInt(req.body.qty, 10) || 1)
    const food = await Food.findById(req.body.foodId).lean()
    if (!food || food.isActiveGlobal === false) {
      return res.status(400).json({ message: 'Food not available' })
    }

    const norm = await normalizeSelections(food, req.body.ingredients || [], req.body.groups || [])

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $push: { items: { foodId: food._id, qty, ingredients: norm.ingredients, groups: norm.groups } } },
      { new: true, upsert: true }
    )
    res.status(201).json(cart)
  } catch (e) { next(e) }
}

// PUT /cart/items/:itemId  body: { qty?, ingredients?, groups? }
exports.updateItem = async (req, res, next) => {
  try {
    const userId = getUserId(req)
    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ message: 'Cart not found' })
    const item = cart.items.id(req.params.itemId)
    if (!item) return res.status(404).json({ message: 'Cart item not found' })

    const food = await Food.findById(item.foodId).lean()
    if (!food) return res.status(400).json({ message: 'Food not available' })

    if (req.body.qty !== undefined) {
      item.qty = Math.max(1, parseInt(req.body.qty, 10) || 1)
    }
    if (req.body.ingredients !== undefined || req.body.groups !== undefined) {
      const norm = await normalizeSelections(food, req.body.ingredients || [], req.body.groups || [])
      item.ingredients = norm.ingredients
      item.groups = norm.groups
    }

    await cart.save()
    res.json(cart)
  } catch (e) { next(e) }
}

// DELETE /cart/items/:itemId
exports.removeItem = async (req, res, next) => {
  try {
    const userId = getUserId(req)
    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ message: 'Cart not found' })
    const item = cart.items.id(req.params.itemId)
    if (!item) return res.status(404).json({ message: 'Cart item not found' })
    item.remove()
    await cart.save()
    res.json(cart)
  } catch (e) { next(e) }
}

// DELETE /cart  (clear)
exports.clear = async (req, res, next) => {
  try {
    const userId = getUserId(req)
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } }, { upsert: true })
    res.json({ ok: true })
  } catch (e) { next(e) }
}
