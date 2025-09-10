const Counter = require('../models/Counter')

const GUEST_PREFIX = '99'
const PAD = 4 // -> 990001, 990002 ...

async function generateGuestId() {
  const doc = await Counter.findOneAndUpdate(
    { key: 'guest' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  )
  return GUEST_PREFIX + String(doc.seq).padStart(PAD, '0')
}

module.exports = { generateGuestId, GUEST_PREFIX }
