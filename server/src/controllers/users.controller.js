const bcrypt = require('bcryptjs')
const User = require('../models/User')

const ALL_ROLES = ['ADMIN', 'CHEF', 'CUSTOMER']

const countActiveAdmins = async () =>
  User.countDocuments({ role: 'ADMIN', isActive: true })

// GET /api/users?role=ADMIN|CHEF|CUSTOMER&q=abc&page=1&limit=10
const list = async (req, res, next) => {
  try {
    const { role, q, page = 1, limit = 10 } = req.query
    const filter = {}
    if (role && ALL_ROLES.includes(role)) filter.role = role
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { email: new RegExp(q, 'i') }]

    const skip = (Number(page) - 1) * Number(limit)
    const [rows, total] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(filter)
    ])
    res.json({ data: rows, total, page: Number(page), limit: Number(limit) })
  } catch (e) { next(e) }
}

// GET /api/users/:id
const getOne = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (e) { next(e) }
}

// POST /api/users   { name, email, password, role, kitchenId? }
const create = async (req, res, next) => {
  try {
    const { name, email, password, role, kitchenId = null } = req.body
    if (!ALL_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' })

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already in use' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, passwordHash, role, kitchenId, isActive: true })

    const lean = user.toObject()
    delete lean.passwordHash
    res.status(201).json(lean)
  } catch (e) { next(e) }
}

// PUT /api/users/:id   { name?, email?, role?, kitchenId?, isActive? }
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const payload = {}
    ;['name', 'email', 'role', 'kitchenId', 'isActive', 'telegramChatId'].forEach(k => {
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })

    const current = await User.findById(id)
    if (!current) return res.status(404).json({ message: 'User not found' })

    // prevent self role changes that could lock you out
    if (String(req.user._id) === String(id) && payload.role && payload.role !== current.role) {
      return res.status(400).json({ message: 'You cannot change your own role' })
    }

    // if demoting an ADMIN or changing isActive on ADMIN, protect last admin
    if (current.role === 'ADMIN') {
      if (payload.role && payload.role !== 'ADMIN') {
        const adminCount = await countActiveAdmins()
        if (adminCount <= 1) return res.status(400).json({ message: 'Cannot demote the last active admin' })
      }
      if (payload.isActive === false) {
        if (String(req.user._id) === String(id)) {
          return res.status(400).json({ message: 'You cannot deactivate your own account' })
        }
        const adminCount = await countActiveAdmins()
        if (adminCount <= 1) return res.status(400).json({ message: 'Cannot deactivate the last active admin' })
      }
    }

    const updated = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .select('-passwordHash')
    res.json(updated)
  } catch (e) { next(e) }
}

// PATCH /api/users/:id/toggle   { value: boolean }
const toggle = async (req, res, next) => {
  try {
    const { id } = req.params
    const { value } = req.body

    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (String(req.user._id) === String(id)) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' })
    }
    if (user.role === 'ADMIN' && value === false) {
      const adminCount = await countActiveAdmins()
      if (adminCount <= 1) return res.status(400).json({ message: 'Cannot deactivate the last active admin' })
    }

    user.isActive = !!value
    await user.save()
    const lean = user.toObject(); delete lean.passwordHash
    res.json(lean)
  } catch (e) { next(e) }
}

// PATCH /api/users/:id/password   { password }
const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params
    const { password } = req.body
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // allow resetting your own password OR any user as admin
    user.passwordHash = await bcrypt.hash(password, 10)
    await user.save()
    res.json({ ok: true })
  } catch (e) { next(e) }
}

// DELETE /api/users/:id
const removeOne = async (req, res, next) => {
  try {
    const { id } = req.params
    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    if (String(req.user._id) === String(id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' })
    }
    if (user.role === 'ADMIN') {
      const adminCount = await countActiveAdmins()
      if (adminCount <= 1) return res.status(400).json({ message: 'Cannot delete the last active admin' })
    }

    await User.deleteOne({ _id: id })
    res.json({ ok: true })
  } catch (e) { next(e) }
}

module.exports = { list, getOne, create, update, toggle, resetPassword, removeOne }
