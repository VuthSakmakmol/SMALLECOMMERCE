// models/Ingredient.js
const mongoose = require('mongoose')
const slugify = require('slugify')

const ING_TYPES = ['BOOLEAN', 'PERCENT', 'CHOICE']

const ingredientSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true, unique: true },
  slug:  { type: String, required: true, trim: true, unique: true, index: true },
  type:  { type: String, enum: ING_TYPES, required: true, default: 'BOOLEAN' },

  // For CHOICE
  choices: [{ value: { type: String }, label: { type: String } }],

  // For PERCENT
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 25 },

  // For BOOLEAN: true/false/null; for PERCENT: number; for CHOICE: string
  defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },

  allergen: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

// Auto-slug from name if missing
ingredientSchema.pre('validate', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true })
  }
  next()
})

// Optional: extra validations per type
ingredientSchema.pre('save', function (next) {
  if (this.type === 'PERCENT') {
    if (this.min > this.max) return next(new Error('min cannot be greater than max'))
    if (this.defaultValue != null) {
      const v = Number(this.defaultValue)
      if (Number.isNaN(v)) return next(new Error('defaultValue must be a number for PERCENT'))
      if (v < this.min || v > this.max) return next(new Error('defaultValue out of range'))
    }
  }
  if (this.type === 'CHOICE') {
    if (!Array.isArray(this.choices) || this.choices.length === 0) {
      return next(new Error('choices required for CHOICE type'))
    }
    if (this.defaultValue != null) {
      const ok = this.choices.some(c => c.value === this.defaultValue)
      if (!ok) return next(new Error('defaultValue must be one of choices.value'))
    }
  }
  if (this.type === 'BOOLEAN' && this.defaultValue != null && typeof this.defaultValue !== 'boolean') {
    return next(new Error('defaultValue must be boolean for BOOLEAN type'))
  }
  next()
})

module.exports = mongoose.model('Ingredient', ingredientSchema)
module.exports.ING_TYPES = ING_TYPES
