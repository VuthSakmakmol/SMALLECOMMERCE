const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const signToken = (user) => {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' } // adjust as needed
  )
}

/**
 * POST /api/auth/register
 * body: { name, email, password, role? ('ADMIN'|'CHEF'|'CUSTOMER'), kitchenId? }
 * - Admin can create any role.
 * - Public register creates CUSTOMER only (if you later expose it).
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role = 'CUSTOMER', kitchenId = null } = req.body

    const exists = await User.findOne({ email })
    if (exists) return res.status(409).json({ message: 'Email already registered' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, passwordHash, role, kitchenId })

    const token = signToken(user)
    res.status(201).json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, kitchenId: user.kitchenId }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/auth/login
 * body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await User.findOne({ email })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
    if (!user.isActive) return res.status(401).json({ message: 'User inactive' })

    const token = signToken(user)
    res.json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, role: user.role, kitchenId: user.kitchenId }
    })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/auth/me
 * header: Authorization: Bearer <token>
 */
const me = async (req, res, next) => {
  try {
    // req.user set by authenticate middleware
    res.json({ user: req.user })
  } catch (err) {
    next(err)
  }
}

module.exports = { register, login, me }
