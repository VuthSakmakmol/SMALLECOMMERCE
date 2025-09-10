// models/Cart.js
const mongoose = require('mongoose')

const CartIngSel = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  included: { type: Boolean, default: true },                 // toggle include/exclude
  value: { type: mongoose.Schema.Types.Mixed, default: null } // PERCENT number, CHOICE string, BOOLEAN null
}, { _id: false })

const CartGroupSel = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChoiceGroup', required: true },
  choice: { type: String, default: null } // one of group's choices.value
}, { _id: false })

const CartItem = new mongoose.Schema({
  foodId: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
  qty: { type: Number, default: 1, min: 1 },
  ingredients: { type: [CartIngSel], default: [] },
  groups: { type: [CartGroupSel], default: [] },
}, { timestamps: true })

const CartSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true }, // use req.user.sub or a guest id header
  items: { type: [CartItem], default: [] },
}, { timestamps: true })

module.exports = mongoose.model('Cart', CartSchema)
