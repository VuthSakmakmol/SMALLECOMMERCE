const mongoose = require('mongoose')

const ROLES = ['ADMIN', 'CHEF', 'CUSTOMER']

const userSchema = new mongoose.Schema(
  {
    // 👇 ID used at login (NOT the display name)
    loginId: { type: String, required: true, unique: true, trim: true },
    guestOrg: { type: String, default: null, trim: true }, // ← NEW
    // Display name (e.g., "vuth sakmakmol", or "GUEST" for guests)
    name: { type: String, required: true, trim: true },

    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, required: true, default: 'CUSTOMER' },
    isGuest: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    telegramChatId: { type: String, default: null },
    kitchenId: { type: String, default: null },
  },
  { timestamps: true }
)


// keep only this safety check (don’t force name = 'GUEST' anymore)
userSchema.pre('save', function (next) {
  if (this.isGuest && !String(this.loginId).startsWith('99')) {
    return next(new Error('Guest ID must start with 99'))
  }
  next()
})


module.exports = mongoose.model('User', userSchema)
module.exports.ROLES = ROLES
