const mongoose = require('mongoose')

const choiceGroupSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true, unique: true },
  key:      { type: String, required: true, trim: true, unique: true, index: true }, // e.g. "coffeeType"
  selection:{ type: String, enum: ['SINGLE'], default: 'SINGLE' }, // extend later if needed
  required: { type: Boolean, default: true },
  choices:  [{ value: { type: String }, label: { type: String } }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true })

module.exports = mongoose.model('ChoiceGroup', choiceGroupSchema)
