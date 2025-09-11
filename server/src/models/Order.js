// server/src/models/Order.js
const mongoose = require('mongoose')

// ── Item snapshots ────────────────────────────────────────────────────────────
// We store "mods" as the source of truth (only user selections).
// We also keep readable snapshots (ingredients/groups) derived from mods.

const itemIngredientSnapSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  included:     { type: Boolean, default: true },  // for BOOLEAN
  value:        { type: mongoose.Schema.Types.Mixed, default: null }, // for PERCENT/CHOICE
  name:         { type: String, default: null }, // optional human label
}, { _id: false })

const itemGroupSnapSchema = new mongoose.Schema({
  groupId:     { type: mongoose.Schema.Types.ObjectId, ref: 'ChoiceGroup', required: true },
  choice:      { type: mongoose.Schema.Types.Mixed, default: null }, // selected value
  choiceLabel: { type: String, default: null }, // optional human label
}, { _id: false })

const itemModSchema = new mongoose.Schema({
  // kind: 'INGREDIENT' | 'GROUP'
  kind: { type: String, enum: ['INGREDIENT', 'GROUP'], required: true },

  // INGREDIENT
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient' },
  // GROUP
  groupId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ChoiceGroup' },

  // for both (we keep enough to render without re-fetch)
  key:   { type: String, default: null },    // ingredient.slug or group.key (optional)
  type:  { type: String, default: null },    // 'BOOLEAN'|'PERCENT'|'CHOICE' (optional)
  value: { type: mongoose.Schema.Types.Mixed, default: null },  // the picked value
  label: { type: String, default: null },    // human label (ingredient/group name)
}, { _id: false })

const orderItemSchema = new mongoose.Schema({
  kind:      { type: String, enum: ['FOOD', 'PACKAGE'], required: true },
  foodId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Food' },
  packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },

  qty:       { type: Number, min: 1, required: true, default: 1 },
  name:      { type: String, default: '' },
  imageUrl:  { type: String, default: '' },
  unitPrice: { type: Number, default: 0 },     // ignored (free mode)

  // 👇 source of truth: only the user's actual selections (diffs)
  mods:        { type: [itemModSchema], default: [] },

  // 👇 derived snapshots (for easier querying/reading)
  ingredients: { type: [itemIngredientSnapSchema], default: [] },
  groups:      { type: [itemGroupSnapSchema], default: [] },
}, { _id: false })

orderItemSchema.pre('validate', function (next) {
  if (this.kind === 'FOOD') {
    if (!this.foodId) return next(new Error('foodId is required for FOOD item'))
    this.packageId = undefined
  } else if (this.kind === 'PACKAGE') {
    if (!this.packageId) return next(new Error('packageId is required for PACKAGE item'))
    this.foodId = undefined
    this.mods = []            // packages don't carry food-level mods
    this.ingredients = []
    this.groups = []
  }
  next()
})

// ── Order ─────────────────────────────────────────────────────────────────────
const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']
const STATUSES    = ['PLACED', 'ACCEPTED', 'COOKING', 'READY', 'DELIVERED', 'CANCELED']

const orderSchema = new mongoose.Schema({
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
  updatedBy:   { type: String, default: null },
}, { timestamps: true })

orderSchema.index({ createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })

module.exports = mongoose.model('Order', orderSchema)
