const mongoose = require('mongoose')

const ROLES = ['ADMIN', 'CHEF', 'CUSTOMER']

const userSchema = new mongoose.Schema(
  {
    // username (unique, required)
    name: { type: String, required: true, unique: true, trim: true },

    // removed: email

    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: 'CUSTOMER' },
    isActive: { type: Boolean, default: true },
    telegramChatId: { type: String, default: null },
    kitchenId: { type: String, default: null },
  },
  { timestamps: true }
)

// keep only username unique index
userSchema.index({ name: 1 }, { unique: true })

module.exports = mongoose.model('User', userSchema)
module.exports.ROLES = ROLES
