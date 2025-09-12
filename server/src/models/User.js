// server/src/models/User.js
const mongoose = require('mongoose')
const { GUEST_PREFIX } = require('../utils/guest') // e.g. '99'

const ROLES = ['ADMIN', 'CHEF', 'CUSTOMER']

const userSchema = new mongoose.Schema(
  {
    // ID used for login (NOT display name)
    loginId: { type: String, required: true, unique: true, trim: true },

    // Optional organization for guests
    guestOrg: { type: String, default: null, trim: true },

    // Display name (e.g., "Tony (guest)")
    name: { type: String, required: true, trim: true },

    passwordHash: { type: String, required: true },

    role: { type: String, enum: ROLES, required: true, default: 'CUSTOMER' },

    // Guest flag
    isGuest: { type: Boolean, default: false },

    isActive: { type: Boolean, default: true },

    telegramChatId: { type: String, default: null },

    // For CHEF role (optional)
    kitchenId: { type: String, default: null },
  },
  { timestamps: true }
)

/* ---------- Helpers ---------- */
function withGuestSuffix(name) {
  const nm = String(name || '').trim()
  if (!nm) return nm
  return /\(guest\)$/i.test(nm) ? nm : `${nm} (guest)`
}

/* ---------- Validation / Normalization ---------- */
userSchema.pre('validate', function (next) {
  // Enforce guest/non-guest ID rules
  const id = String(this.loginId || '')
  const startsWithGuestPrefix = id.startsWith(GUEST_PREFIX)

  if (this.isGuest) {
    // Guest ID must start with 99...
    if (!startsWithGuestPrefix) {
      return next(new Error(`Guest ID must start with ${GUEST_PREFIX}`))
    }
    // Guest role must be CUSTOMER
    if (this.role !== 'CUSTOMER') {
      return next(new Error('Guests must have CUSTOMER role'))
    }
    // Guest display name is required and must end with " (guest)"
    const nm = String(this.name || '').trim()
    if (!nm) {
      return next(new Error('Display name required for guest'))
    }
    this.name = withGuestSuffix(nm)
  } else {
    // Non-guest cannot use a 99… loginId
    if (startsWithGuestPrefix) {
      return next(new Error(`IDs starting with ${GUEST_PREFIX} are reserved for guests`))
    }
    // Non-guest name still required by schema; nothing else to normalize
  }

  next()
})

/* ---------- Output shape: hide password hash ---------- */
userSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.passwordHash
    return ret
  },
})

module.exports = mongoose.model('User', userSchema)
module.exports.ROLES = ROLES
