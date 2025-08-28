// server/src/models/Order.js
const mongoose = require('mongoose')

const orderItemSchema = new mongoose.Schema(
  {
    kind:      { type: String, enum: ['FOOD', 'PACKAGE'], required: true },
    foodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    qty:       { type: Number, min: 1, required: true },

    // snapshots (app is free; price ignored)
    name:      { type: String, default: '' },
    unitPrice: { type: Number, default: 0 }
  },
  { _id: false }
)

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

const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']
const STATUSES    = ['PLACED','ACCEPTED','COOKING','READY','DELIVERED','CANCELED']

const orderSchema = new mongoose.Schema(
  {
    type:        { type: String, enum: ORDER_TYPES, required: true },
    status:      { type: String, enum: STATUSES, default: 'PLACED', index: true },

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

    // free mode
    grandTotal:  { type: Number, default: 0 },

    // stock control
    stockCommitted: { type: Boolean, default: false },

    // lifecycle timestamps
    acceptedAt:  { type: Date, default: null },
    cookingAt:   { type: Date, default: null },
    readyAt:     { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    canceledAt:  { type: Date, default: null },

    createdBy:   { type: String, default: null },
    updatedBy:   { type: String, default: null }
  },
  { timestamps: true }
)

orderSchema.index({ createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Order', orderSchema)
