const User = require('../models/User')

const GUEST_PREFIX = '99'  // keep in sync with FE

// Generate a 6-digit loginId starting with 99 (e.g. 99xxxx). Ensures uniqueness.
async function generateGuestId() {
  // try a few random candidates; loginId is unique so DB will enforce too
  for (let i = 0; i < 25; i++) {
    const four = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    const candidate = `${GUEST_PREFIX}${four}`
    const exists = await User.exists({ loginId: candidate })
    if (!exists) return candidate
  }
  // fallback to incremental scan (rare)
  let num = 990000
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const id = String(num++)
    const exists = await User.exists({ loginId: id })
    if (!exists) return id
  }
}

module.exports = { generateGuestId, GUEST_PREFIX }
