const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema(
  {
    name:      { type: String, required: true, trim: true },
    nameNorm:  { type: String, required: true, unique: true, select: false }, // lowercased name
    slug:      { type: String, unique: true, index: true },
    isActive:  { type: Boolean, default: true }
  },
  { timestamps: true, versionKey: false }
)

// simple slugify that works with Unicode letters & numbers
function toSlug(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

// normalize name for unique, case-insensitive storage
function normName(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

categorySchema.pre('validate', function (next) {
  if (this.isModified('name')) {
    this.name = String(this.name || '').trim()
    this.nameNorm = normName(this.name)
    this.slug = toSlug(this.name)
  }
  next()
})

module.exports = mongoose.model('Category', categorySchema)
module.exports.toSlug = toSlug
