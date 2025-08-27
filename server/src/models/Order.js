// server/src/models/Order.js
const mongoose = require('mongoose')

/**
 * Order Item (snapshot)
 * - kind: 'FOOD' or 'PACKAGE'
 * - For FOOD, provide foodId; for PACKAGE, provide packageId
 * - name/unitPrice are optional snapshots; price is ignored by the app (free)
 */
const orderItemSchema = new mongoose.Schema(
  {
    kind:      { type: String, enum: ['FOOD', 'PACKAGE'], required: true },
    foodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    qty:       { type: Number, min: 1, required: true },

    // optional snapshots (safe to keep for compatibility; app treats everything as free)
    name:      { type: String, default: '' },
    unitPrice: { type: Number, default: 0 }
  },
  { _id: false }
)

// ensure correct id is present per item kind
orderItemSchema.pre('validate', function (next) {
  if (this.kind === 'FOOD') {
    if (!this.foodId) return next(new Error('foodId is required for FOOD item'))
    this.packageId = undefined
  } else if (this.kind === 'PACKAGE') {
    if (!this.packageId) return next(new Error('packageId is required for PACKAGE item'))
    this.foodId = undefined
  }
  next()
})

const STATUS = ['PENDING', 'ACCEPTED', 'COOKING', 'READY', 'DELIVERED', 'CANCELED', 'PLACED']
// Default is PENDING to match your routes/filters
const TYPE = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']

const orderSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: TYPE, required: true },
    status:      { type: String, enum: STATUS, default: 'PENDING', index: true },

    customerId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    groupKey:    { type: String, default: null },
    notes:       { type: String, default: '' },

    items: {
      type: [orderItemSchema],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'At least one item is required'
      }
    },

    // kept for compatibility; always 0 in free mode
    grandTotal:  { type: Number, default: 0 },

    // timestamps for lifecycle (optional, used by UI)
    acceptedAt:  { type: Date, default: null },
    startedAt:   { type: Date, default: null }, // cooking started
    readyAt:     { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    canceledAt:  { type: Date, default: null }
  },
  { timestamps: true }
)

// helpful indexes
orderSchema.index({ createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Order', orderSchema)
