const mongoose = require('mongoose')

const orderSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  kitchenId:  { type: String, default: null },
  items: [{
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
    nameSnapshot: { type: String, required: true },
    qty: { type: Number, default: 1 },
    preferences: { type: Object, default: {} }
  }],
  status: { type: String, enum: ['PENDING','ACCEPTED','COOKING','READY','DELIVERED','CANCELED'], default: 'PENDING', index: true },
  timeline: [{ status: String, at: Date, byUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, note: String }]
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)
