const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' })

// POST /api/auth/register   body: { username, password }
const registerCustomer = async (req, res, next) => {
  try {
    const username = String(req.body.username ?? '').trim()
    const password = req.body.password

    if (!username) return res.status(400).json({ message: 'Username required' })
    if (!password || String(password).length < 6)
      return res.status(400).json({ message: 'Password min 6 chars' })

    const exists = await User.findOne({ name: username })
    if (exists) return res.status(409).json({ message: 'Username already taken' })

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      name: username,
      passwordHash,
      role: 'CUSTOMER',
      isActive: true,
      kitchenId: null,
    })

    const token = signToken(user)
    res.status(201).json({
      token,
      user: { _id: user._id, name: user.name, role: user.role, kitchenId: user.kitchenId },
    })
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.name)
      return res.status(409).json({ message: 'Username already taken' })
    next(err)
  }
}

// POST /api/auth/login  body: { username, password }
const login = async (req, res, next) => {
  try {
    const username = String(req.body.username ?? '').trim()
    const password = req.body.password
    if (!username || !password) return res.status(400).json({ message: 'Invalid credentials' })

    const user = await User.findOne({ name: username })
    if (!user) return res.status(401).json({ message: 'Invalid credentials' })

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) return res.status(401).json({ message: 'Invalid credentials' })
    if (!user.isActive) return res.status(401).json({ message: 'User inactive' })

    const token = signToken(user)
    res.json({
      token,
      user: { _id: user._id, name: user.name, role: user.role, kitchenId: user.kitchenId },
    })
  } catch (err) {
    next(err)
  }
}

// GET /api/auth/me
const me = async (req, res, next) => {
  try { res.json({ user: req.user }) } catch (err) { next(err) }
}

module.exports = { registerCustomer, login, me }
