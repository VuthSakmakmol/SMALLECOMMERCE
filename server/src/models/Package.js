// models/Package.js
const mongoose = require('mongoose')

const packageItemSchema = new mongoose.Schema({
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  qty: { type: Number, min: 1, required: true }
}, { _id: false })

const packageSchema = new mongoose.Schema({
  // Restrict to 3 types and also make name unique so each type exists once
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
  items: { type: [packageItemSchema], default: [] }, // required in controller
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

/* simple slugify */
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
