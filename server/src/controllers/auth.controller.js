const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')
const { generateGuestId, GUEST_PREFIX } = require('../utils/guest')

const signToken = (user) =>
  jwt.sign(
    { sub: String(user._id), role: user.role, isGuest: !!user.isGuest, id: user.loginId },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

/**
 * POST /api/auth/register   (EMPLOYEE SELF-REGISTER)
 * body: { id, username, password }
 * - role is fixed to CUSTOMER
 * - id cannot start with '99'
 */
const registerEmployee = async (req, res, next) => {
  try {
    const loginId  = String(req.body.id ?? '').trim()
    const name     = String(req.body.username ?? '').trim()
    const password = req.body.password

    if (!loginId) return res.status(400).json({ message: 'ID required' })
    if (loginId.startsWith(GUEST_PREFIX))
      return res.status(400).json({ message: `IDs starting with ${GUEST_PREFIX} are reserved for guests` })
    if (!name) return res.status(400).json({ message: 'Display name required' })
    if (!password || String(password).length < 6)
      return res.status(400).json({ message: 'Password min 6 chars' })

    const exists = await User.findOne({ loginId })
    if (exists) return res.status(409).json({ message: 'ID already in use' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      loginId,
      name,
      passwordHash,
      role: 'CUSTOMER',
      isGuest: false,
      isActive: true,
      kitchenId: null,
    })

    const token = signToken(user)
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        id: user.loginId,
        name: user.name,
        role: user.role,
        isGuest: user.isGuest,
        kitchenId: user.kitchenId,
      },
    })
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.loginId)
      return res.status(409).json({ message: 'ID already in use' })
    next(err)
  }
}

/**
 * POST /api/auth/register-guest
 * body: { password, displayName, fromCompany? }
 * - generates loginId "99xxxx"
 * - name stored as "<displayName> (guest)"
 * - role is CUSTOMER, isGuest=true
 */
const registerGuest = async (req, res, next) => {
  try {
    const password     = req.body.password
    const displayName  = String(req.body.displayName ?? '').trim()
    const fromCompany  = String(req.body.fromCompany ?? '').trim()

    if (!password || String(password).length < 6)
      return res.status(400).json({ message: 'Password min 6 chars' })
    if (!displayName)
      return res.status(400).json({ message: 'Display name required' })

    const loginId = await generateGuestId()
    const passwordHash = await bcrypt.hash(password, 10)

    const user = await User.create({
      loginId,
      name: /\(guest\)$/i.test(displayName) ? displayName : `${displayName} (guest)`,
      guestOrg: fromCompany || null,
      passwordHash,
      role: 'CUSTOMER',
      isGuest: true,
      isActive: true,
      kitchenId: null,
    })

    const token = signToken(user)
    res.status(201).json({
      token,
      user: {
        _id: user._id,
        id: user.loginId,
        name: user.name,
        guestOrg: user.guestOrg,
        role: user.role,
        isGuest: user.isGuest,
        kitchenId: user.kitchenId,
      },
    })
  } catch (err) { next(err) }
}

/**
 * POST /api/auth/login
 * body: { id, password }
 */
const login = async (req, res, next) => {
  try {
    const loginId = String(req.body.id ?? '').trim()
    const password = req.body.password
    if (!loginId || !password) return res.status(400).json({ message: 'Invalid credentials' })

    const user = await User.findOne({ loginId })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
    if (!user.isActive) return res.status(401).json({ message: 'User inactive' })

    const token = signToken(user)
    res.json({
      token,
      user: {
        _id: user._id,
        id: user.loginId,
        name: user.name,
        role: user.role,
        isGuest: user.isGuest,
        kitchenId: user.kitchenId,
      },
    })
  } catch (err) { next(err) }
}

/** GET /api/auth/me */
const me = async (req, res, next) => {
  try { res.json({ user: req.user }) } catch (err) { next(err) }
}

module.exports = { registerEmployee, registerGuest, login, me }
