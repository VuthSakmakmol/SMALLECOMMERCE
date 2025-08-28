// server/src/models/Food.js
const mongoose = require('mongoose')

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true
    },

    imageUrl: { type: String, default: '' },
    description: { type: String, default: '' },
    tags: { type: [String], default: [] }, // e.g. ['spicy','sour','salad']

    // availability (shown to customers = isActiveGlobal && isActiveKitchen)
    isActiveGlobal: { type: Boolean, default: true },   // admin control
    isActiveKitchen: { type: Boolean, default: true },  // chef control

    // daily portions control
    dailyLimit:     { type: Number, default: null }, // null = unlimited
    stockDate:      { type: String,  default: null }, // 'YYYY-MM-DD'
    stockRemaining: { type: Number,  default: null },

    createdBy: { type: String, default: null },
    updatedBy: { type: String, default: null }
  },
  { timestamps: true }
)

module.exports = mongoose.model('Food', foodSchema)
