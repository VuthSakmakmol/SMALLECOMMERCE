const jwt = require('jsonwebtoken')
const User = require('../models/User')

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return res.status(401).json({ message: 'Missing token' })

    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.sub).lean()
    if (!user || !user.isActive) return res.status(401).json({ message: 'User not found or inactive' })

    req.user = { _id: String(user._id), name: user.name, role: user.role, kitchenId: user.kitchenId || null }
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthenticated' })
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  next()
}

module.exports = { authenticate, authorize }
