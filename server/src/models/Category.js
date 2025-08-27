const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, index: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
)

// simple slugify
function toSlug(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
}

categorySchema.pre('save', function (next) {
  if (this.isModified('name')) this.slug = toSlug(this.name)
  next()
})

module.exports = mongoose.model('Category', categorySchema)
