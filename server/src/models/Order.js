const mongoose = require('mongoose')

const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']
const ORDER_STATUS = ['PLACED', 'ACCEPTED', 'COOKING', 'READY', 'COMPLETED', 'CANCELED']

const orderItemSchema = new mongoose.Schema({
  // line can be a single food OR a package
  kind: { type: String, enum: ['FOOD', 'PACKAGE'], required: true },
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', default: null },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package', default: null },

  // snapshot fields (denormalize to keep history even if menu changes)
  name: { type: String, required: true },
  imageUrl: { type: String, default: '' },
  qty: { type: Number, min: 1, required: true },
  unitPrice: { type: Number, min: 0, required: true }, // price used at checkout time
  extras: { type: Object, default: {} }                 // e.g., ice/less-sugar, notes
}, { _id: false })

const orderSchema = new mongoose.Schema({
  type: { type: String, enum: ORDER_TYPES, required: true },

  // who/where
  customerId: { type: String, default: null },          // optional user id
  customerName: { type: String, default: '' },
  phone: { type: String, default: '' },

  // shared “group” context (table/room/group code)
  groupKey: { type: String, default: null, index: true }, // e.g., TABLE-12 or ROOM-3

  // cart
  items: { type: [orderItemSchema], default: [] },
  subtotal: { type: Number, min: 0, default: 0 },
  discount: { type: Number, min: 0, default: 0 },
  serviceFee: { type: Number, min: 0, default: 0 },
  grandTotal: { type: Number, min: 0, default: 0 },

  notes: { type: String, default: '' },

  // status flow
  status: { type: String, enum: ORDER_STATUS, default: 'PLACED', index: true },
  acceptedAt: { type: Date, default: null },
  cookingAt: { type: Date, default: null },
  readyAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  canceledAt: { type: Date, default: null },

  // audit
  createdBy: { type: String, default: null },
  updatedBy: { type: String, default: null },

  // payment (extend later)
  paymentStatus: { type: String, enum: ['UNPAID', 'PAID', 'REFUNDED'], default: 'UNPAID' },
  paymentMethod: { type: String, default: '' }
}, { timestamps: true })

module.exports = mongoose.model('Order', orderSchema)
