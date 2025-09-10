const ChoiceGroup = require('../models/ChoiceGroup')
const Food = require('../models/Food')

/** GET /choice-groups?activeOnly=&q= */
const list = async (req, res, next) => {
  try {
    const { activeOnly, q } = req.query
    const filter = {}
    if (String(activeOnly) === 'true') filter.isActive = true
    if (q) {
      const rx = new RegExp(q, 'i')
      filter.$or = [{ name: rx }, { key: rx }]
    }
    const rows = await ChoiceGroup.find(filter).sort({ name: 1 }).lean()
    res.json(rows)
  } catch (e) { next(e) }
}

const getOne = async (req, res, next) => {
  try {
    const row = await ChoiceGroup.findById(req.params.id).lean()
    if (!row) return res.status(404).json({ message: 'Choice group not found' })
    res.json(row)
  } catch (e) { next(e) }
}

/** POST /choice-groups */
const create = async (req, res, next) => {
  try {
    const payload = {
      name: req.body.name,
      key:  req.body.key,
      selection: 'SINGLE',
      required: !!req.body.required,
      choices: Array.isArray(req.body.choices) ? req.body.choices : []
    }
    const dup = await ChoiceGroup.findOne({ $or: [{ name: payload.name }, { key: payload.key }] })
    if (dup) return res.status(409).json({ message: 'Name or key already exists' })

    const row = await ChoiceGroup.create(payload)
    res.status(201).json(row)
  } catch (e) { next(e) }
}

const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name','key','required','choices','isActive'].forEach(k=>{
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })

    if (payload.name || payload.key) {
      const cond = { _id: { $ne: id }, $or: [] }
      if (payload.name) cond.$or.push({ name: payload.name })
      if (payload.key)  cond.$or.push({ key:  payload.key  })
      if (cond.$or.length) {
        const dup = await ChoiceGroup.findOne(cond)
        if (dup) return res.status(409).json({ message: 'Name or key already in use' })
      }
    }

    const row = await ChoiceGroup.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
    if (!row) return res.status(404).json({ message: 'Choice group not found' })
    res.json(row)
  } catch (e) { next(e) }
}

const toggle = async (req, res, next) => {
  try {
    const row = await ChoiceGroup.findByIdAndUpdate(req.params.id, { isActive: !!req.body.value }, { new: true })
    if (!row) return res.status(404).json({ message: 'Choice group not found' })
    res.json(row)
  } catch (e) { next(e) }
}

const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const inUse = await Food.countDocuments({ 'choiceGroups.groupId': id })
    if (inUse > 0) return res.status(400).json({ message: 'Cannot delete; group is used by foods', inUse })
    const row = await ChoiceGroup.findByIdAndDelete(id)
    if (!row) return res.status(404).json({ message: 'Choice group not found' })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { list, getOne, create, update, toggle, removeOne }
