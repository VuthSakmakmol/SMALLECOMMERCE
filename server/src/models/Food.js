const mongoose = require('mongoose')
const { Schema, model } = mongoose

const foodSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameNorm: { type: String, required: true, select: false }, // unique per category (case-insensitive)
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    tags: { type: [String], default: [] },

    // visibility
    isActiveGlobal:  { type: Boolean, default: true },
    isActiveKitchen: { type: Boolean, default: true },

    // current stock (no daily reset). null = unlimited (won’t decrement)
    stockQty: { type: Number, default: null, min: 0 },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null },
  },
  { timestamps: true, versionKey: false }
)

// unique per category, case-insensitive
foodSchema.index({ categoryId: 1, nameNorm: 1 }, { unique: true })

function normName(s){ return String(s||'').toLowerCase().trim().replace(/\s+/g,' ') }
function normTags(arr){ const a = Array.isArray(arr) ? arr : []; return Array.from(new Set(a.map(t=>String(t||'').toLowerCase().trim()).filter(Boolean))) }

foodSchema.pre('validate', function(next){
  if (this.isModified('name')) this.nameNorm = normName(this.name)
  if (this.isModified('tags')) this.tags = normTags(this.tags)
  next()
})

module.exports = model('Food', foodSchema)
