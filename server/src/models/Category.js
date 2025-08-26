const mongoose = require('mongoose')

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null }, // optional nesting
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 }
  },
  { timestamps: true }
)

categorySchema.pre('save', function (next) {
  if (!this.isModified('name')) return next()
  this.slug = String(this.name).toLowerCase().trim().replace(/[./\\\s]+/g, '-')
  next()
})

module.exports = mongoose.model('Category', categorySchema)
