const mongoose = require('mongoose')

const FoodIngredientSchema = new mongoose.Schema({
  ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ingredient', required: true },
  defaultIncluded: { type: Boolean, default: true },
  removable: { type: Boolean, default: true },
  // BOOLEAN: boolean|null, PERCENT: number, CHOICE: string
  defaultValue: { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false })

const FoodChoiceGroupSchema = new mongoose.Schema({
  groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChoiceGroup', required: true },
  defaultChoice: { type: String, default: null }
}, { _id: false })

const foodSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
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
  ingredients:   { type: [FoodIngredientSchema], default: [] },
  choiceGroups:  { type: [FoodChoiceGroupSchema], default: [] },

  createdBy:  { type: String, default: null },
  updatedBy:  { type: String, default: null },
}, { timestamps: true })

module.exports = mongoose.model('Food', foodSchema)
