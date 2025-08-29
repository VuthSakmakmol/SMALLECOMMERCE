const mongoose = require('mongoose')

const ROLES = ['ADMIN', 'CHEF', 'CUSTOMER']

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: 'CUSTOMER' },
    isActive: { type: Boolean, default: true },
    telegramChatId: { type: String, default: null },
    kitchenId: { type: String, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('User', userSchema)
module.exports.ROLES = ROLES
