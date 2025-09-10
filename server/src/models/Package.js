const mongoose = require('mongoose')

const { Schema, model } = mongoose
const ALLOWED_NAMES = ['Individual', 'Group', 'Workshop']

const itemSchema = new Schema(
  {
    foodId: { type: Schema.Types.ObjectId, ref: 'Food', required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
)

function noDuplicateFoods(items) {
  const ids = items.map(i => String(i.foodId))
  return ids.length === new Set(ids).size
}

const packageSchema = new Schema(
  {
    name: { type: String, enum: ALLOWED_NAMES, required: true, unique: true },

    description: { type: String, default: '' },
    imageUrl: { type: String, default: '' },

    items: {
      type: [itemSchema],
      default: [],
      validate: [
        { validator: (arr) => Array.isArray(arr) && arr.length > 0, message: 'Package must contain at least one item' },
        { validator: noDuplicateFoods, message: 'Duplicate foodId in items' }
      ]
    },

    isActive: { type: Boolean, default: true },

    // STATIC stock display (no reset, no decrement)
    availableQty: { type: Number, default: null, min: 0 }, // null = not tracked / unlimited label
  },
  { timestamps: true, versionKey: false }
)

module.exports = model('Package', packageSchema)
module.exports.ALLOWED_PACKAGE_NAMES = ALLOWED_NAMES
