// server/src/models/Food.js
const mongoose = require('mongoose');

const FoodIngredientSchema = new mongoose.Schema({
  ingredientId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  defaultIncluded: { type: Boolean, default: true },
  removable:       { type: Boolean, default: true },
  // BOOLEAN: boolean|null, PERCENT: number, CHOICE: string
  defaultValue:    { type: mongoose.Schema.Types.Mixed, default: null },
}, { _id: false });

const FoodChoiceGroupSchema = new mongoose.Schema({
  groupId:       { type: mongoose.Schema.Types.ObjectId, ref: 'ChoiceGroup', required: true },
  defaultChoice: { type: String, default: null },
}, { _id: false });

const foodSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  // ↓ computed from name; used for case-insensitive uniqueness per category
  nameNorm:    { type: String, default: null, index: true },

  categoryId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true, index: true },

  imageUrl:    { type: String, default: '' },
  description: { type: String, default: '' },
  tags:        { type: [String], default: [] },

  // availability
  isActiveGlobal:  { type: Boolean, default: true },
  isActiveKitchen: { type: Boolean, default: true },

  // null = unlimited
  stockQty:    { type: Number, default: null, min: 0 },

  // attachments
  ingredients:  { type: [FoodIngredientSchema], default: [] },
  choiceGroups: { type: [FoodChoiceGroupSchema], default: [] },

  createdBy:  { type: String, default: null },
  updatedBy:  { type: String, default: null },
}, { timestamps: true });

/* ───────── normalize name -> nameNorm ───────── */
foodSchema.pre('validate', function(next) {
  const n = (this.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  this.nameNorm = n || null;
  next();
});

/* ───────── unique per (categoryId, nameNorm) when nameNorm is non-empty ───────── */
foodSchema.index(
  { categoryId: 1, nameNorm: 1 },
  { unique: true, partialFilterExpression: { nameNorm: { $type: 'string', $ne: '' } } }
);

module.exports = mongoose.model('Food', foodSchema);
