// server/src/models/Package.js
const mongoose = require('mongoose')

const packageItemSchema = new mongoose.Schema({
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  qty: { type: Number, min: 1, required: true }
}, { _id: false })

const packageSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true, 
    enum: ['Individual', 'Group', 'Workshop'],
    unique: true,
    trim: true
  },
  slug: { type: String, unique: true, index: true },

  description: { type: String, default: '' },
  imageUrl: { type: String, default: '' },

  items: { type: [packageItemSchema], default: [] },
  isActive: { type: Boolean, default: true },

  // NEW: daily stock for packages (optional; null = unlimited)
  dailyLimit:     { type: Number, default: null },
  stockDate:      { type: String,  default: null },   // 'YYYY-MM-DD'
  stockRemaining: { type: Number,  default: null },
}, { timestamps: true })

function toSlug(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

packageSchema.pre('save', function (next) {
  if (this.isModified('name')) this.slug = toSlug(this.name)
  next()
})

module.exports = mongoose.model('Package', packageSchema)
