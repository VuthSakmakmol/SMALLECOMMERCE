const mongoose = require('mongoose')

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    tags: { type: [String], default: [] }, // e.g., ['spicy','sour','salad','raw']

    // availability (effective = isActiveGlobal && isActiveKitchen)
    isActiveGlobal: { type: Boolean, default: true },   // admin control
    isActiveKitchen: { type: Boolean, default: true },  // chef control

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Food', foodSchema)
