const bcrypt = require('bcryptjs')
const User = require('../models/User')
const { GUEST_PREFIX } = require('../utils/guest')

const ALL_ROLES = ['ADMIN', 'CHEF', 'CUSTOMER']

const countActiveAdmins = async () =>
  User.countDocuments({ role: 'ADMIN', isActive: true })

/* helpers */
const withGuestSuffix = (name) => {
  const nm = String(name || '').trim()
  if (!nm) return nm
  return /\(guest\)$/i.test(nm) ? nm : `${nm} (guest)`
}
const isGuestId = (loginId = '') => String(loginId).startsWith(GUEST_PREFIX)

/* BULK IMPORT (non-guest only, same behavior as before) */
const bulkImport = async (req, res, next) => {
  try {
    const items = Array.isArray(req.body) ? req.body : req.body.items
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items to import' })
    }

    const results = []
    for (let i = 0; i < items.length; i++) {
      const raw = items[i] || {}
      const loginId  = String(raw.id ?? raw.loginId ?? '').trim()
      const name     = String(raw.username ?? raw.name ?? '').trim()
      const role     = (raw.role || 'CUSTOMER').toUpperCase()
      const password = raw.password

      if (!loginId) { results.push({ index: i, id: null, status: 'error', message: 'Missing id/loginId' }); continue }
      if (!name)    { results.push({ index: i, id: loginId, status: 'error', message: 'Missing display name' }); continue }
      if (!password || String(password).length < 6) {
        results.push({ index: i, id: loginId, status: 'error', message: 'Password min 6 chars' }); continue
      }
      if (!ALL_ROLES.includes(role)) {
        results.push({ index: i, id: loginId, status: 'error', message: 'Invalid role' }); continue
      }
      if (isGuestId(loginId)) {
        results.push({ index: i, id: loginId, status: 'error', message: `IDs starting with ${GUEST_PREFIX} are reserved for guests` }); continue
      }

      const exists = await User.findOne({ loginId })
      if (exists) { results.push({ index: i, id: loginId, status: 'skipped', message: 'ID already exists' }); continue }

      const passwordHash = await bcrypt.hash(password, 10)
      await User.create({
        loginId,
        name,
        passwordHash,
        role,
        isGuest: false,
        isActive: true,
        kitchenId: null
      })
      results.push({ index: i, id: loginId, status: 'created' })
    }

    const summary = {
      total: results.length,
      created: results.filter(r => r.status === 'created').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    }
    res.status(207).json({ summary, results })
  } catch (e) { next(e) }
}

/* LIST */
// GET /api/users?role=ADMIN|CHEF|CUSTOMER&q=abc&page=1&limit=10
const list = async (req, res, next) => {
  try {
    const { role, q, page = 1, limit = 10 } = req.query
    const filter = {}
    if (role && ALL_ROLES.includes(role)) filter.role = role
    if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { loginId: new RegExp(q, 'i') }]

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

/* GET ONE */
// GET /api/users/:id
const getOne = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-passwordHash').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (e) { next(e) }
}

/* CREATE */
// POST /api/users   { loginId, name, password, role, isGuest?, kitchenId? }
const create = async (req, res, next) => {
  try {
    const { loginId, name, password, role, isGuest = false, kitchenId = null } = req.body
    if (!loginId) return res.status(400).json({ message: 'ID (loginId) required' })
    if (!password || String(password).length < 6) return res.status(400).json({ message: 'Password min 6 chars' })
    if (!ALL_ROLES.includes(role)) return res.status(400).json({ message: 'Invalid role' })

    if (isGuestId(loginId) && !isGuest)
      return res.status(400).json({ message: `IDs starting with ${GUEST_PREFIX} must be guests` })
    if (isGuest && !isGuestId(loginId))
      return res.status(400).json({ message: `Guest ID must start with ${GUEST_PREFIX}` })
    if (isGuest && role !== 'CUSTOMER')
      return res.status(400).json({ message: 'Guests must have CUSTOMER role' })

    let displayName = String(name || '').trim()
    if (isGuest) {
      if (!displayName) return res.status(400).json({ message: 'Display name required for guest' })
      displayName = withGuestSuffix(displayName)
    } else {
      if (!displayName) return res.status(400).json({ message: 'Display name required' })
    }

    const exists = await User.findOne({ loginId })
    if (exists) return res.status(409).json({ message: 'ID already in use' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      loginId,
      name: displayName,
      passwordHash,
      role,
      isGuest: !!isGuest,
      kitchenId,
      isActive: true
    })

    const lean = user.toObject(); delete lean.passwordHash
    res.status(201).json(lean)
  } catch (e) {
    if (e?.code === 11000 && e?.keyPattern?.loginId)
      return res.status(409).json({ message: 'ID already in use' })
    next(e)
  }
}

/* UPDATE */
// PUT /api/users/:id   { loginId?, name?, role?, kitchenId?, isActive?, isGuest? }
const update = async (req, res, next) => {
  try {
    const { id } = req.params
    const current = await User.findById(id)
    if (!current) return res.status(404).json({ message: 'User not found' })

    const payload = {}
    ;['loginId','name','role','kitchenId','isActive','telegramChatId','isGuest'].forEach(k => {
      if (req.body[k] !== undefined) payload[k] = req.body[k]
    })

    // prevent self role change
    if (String(req.user._id) === String(id) && payload.role && payload.role !== current.role) {
      return res.status(400).json({ message: 'You cannot change your own role' })
    }

    // protect last admin
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

    // guest invariants
    const nextIsGuest = payload.isGuest !== undefined ? !!payload.isGuest : !!current.isGuest
    const nextLoginId = payload.loginId || current.loginId
    const nextRole    = payload.role    || current.role

    if (nextIsGuest && !isGuestId(nextLoginId))
      return res.status(400).json({ message: `Guest ID must start with ${GUEST_PREFIX}` })
    if (isGuestId(nextLoginId) && !nextIsGuest)
      return res.status(400).json({ message: `IDs starting with ${GUEST_PREFIX} must be guests` })
    if (nextIsGuest && nextRole !== 'CUSTOMER')
      return res.status(400).json({ message: 'Guests must have CUSTOMER role' })

    if (nextIsGuest) {
      const proposed = String((payload.name ?? current.name) || '').trim()
      if (!proposed) return res.status(400).json({ message: 'Display name required for guest' })
      payload.name = withGuestSuffix(proposed)
    } else if (payload.name !== undefined) {
      payload.name = String(payload.name).trim()
      if (!payload.name) return res.status(400).json({ message: 'Display name required' })
    }

    // enforce loginId uniqueness if changed
    if (payload.loginId && payload.loginId !== current.loginId) {
      const dupe = await User.findOne({ loginId: payload.loginId })
      if (dupe) return res.status(409).json({ message: 'ID already in use' })
    }

    const updated = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true })
      .select('-passwordHash')
    res.json(updated)
  } catch (e) { next(e) }
}

/* RESET PASSWORD */
// PATCH /api/users/:id/password   { password }
const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.params
    const { password } = req.body
    if (!password || String(password).length < 6)
      return res.status(400).json({ message: 'Password min 6 chars' })

    const user = await User.findById(id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    user.passwordHash = await bcrypt.hash(password, 10)
    await user.save()
    res.json({ ok: true })
  } catch (e) { next(e) }
}

/* TOGGLE ACTIVE */
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

/* DELETE */
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

module.exports = { list, getOne, create, update, toggle, resetPassword, removeOne, bulkImport }
