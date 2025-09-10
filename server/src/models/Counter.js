const { Schema, model } = require('mongoose')

// One doc per counter key, e.g. { key: "guest", seq: 123 }
const counterSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    seq: { type: Number, required: true, default: 0 }, // ✅ default on the field, not at root
  },
  { versionKey: false }
)

module.exports = model('Counter', counterSchema)
