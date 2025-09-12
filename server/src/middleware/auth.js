const jwt = require('jsonwebtoken')
const User = require('../models/User')

const authenticate = async (req, res, next) => {
  try {
    const auth = req.headers.authorization || ''
    const [, token] = auth.split(' ')
    if (!token) return res.status(401).json({ message: 'Unauthorized' })

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.sub).select('-passwordHash').lean()
    if (!user || !user.isActive) return res.status(401).json({ message: 'Unauthorized' })

    req.user = user
    next()
  } catch (e) {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' })
  if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' })
  next()
}

module.exports = { authenticate, authorize }
