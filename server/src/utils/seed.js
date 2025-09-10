const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const User = require('../models/User')
const { GUEST_PREFIX } = require('../utils/guest')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('[Seed] Missing MONGODB_URI in .env')
  process.exit(1)
}

const ADMIN_ID = (process.env.ADMIN_ID || '000001').trim()          // login ID
const ADMIN_NAME = (process.env.ADMIN_NAME || 'System Admin').trim()// display name
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'
const ADMIN_RESET = String(process.env.ADMIN_RESET || 'false').toLowerCase() === 'true'

if (ADMIN_ID.startsWith(GUEST_PREFIX)) {
  console.error(`[Seed] ADMIN_ID cannot start with "${GUEST_PREFIX}" (reserved for guests).`)
  process.exit(1)
}

async function ensureIndexes() {
  try { await User.init() } catch (e) { console.warn('[Seed] ensureIndexes warn:', e?.message) }
}

async function upsertAdmin() {
  await mongoose.connect(MONGODB_URI)
  console.log('[MongoDB] Connected for seeding')
  await ensureIndexes()

  let admin = await User.findOne({ loginId: ADMIN_ID })
  if (admin) {
    console.log(`[Seed] Admin found by ID: ${ADMIN_ID}`)
    if (ADMIN_RESET) {
      admin.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
      admin.name = ADMIN_NAME
      admin.role = 'ADMIN'
      admin.isGuest = false
      admin.isActive = true
      await admin.save()
      console.log('[Seed] Admin password reset & ensured flags')
    } else {
      console.log('[Seed] Skipping password reset (ADMIN_RESET != true)')
    }
    return
  }

  const legacyAdmin =
    (await User.findOne({ role: 'ADMIN', name: ADMIN_NAME })) ||
    (await User.findOne({ role: 'ADMIN', name: 'admin' })) ||
    (await User.findOne({ role: 'ADMIN' }))

  if (legacyAdmin) {
    const collision = await User.findOne({ loginId: ADMIN_ID })
    const chosenId = collision ? `${ADMIN_ID}_ADM` : ADMIN_ID

    legacyAdmin.loginId = chosenId
    legacyAdmin.name = ADMIN_NAME
    legacyAdmin.role = 'ADMIN'
    legacyAdmin.isGuest = false
    legacyAdmin.isActive = true

    if (ADMIN_RESET || !legacyAdmin.passwordHash) {
      legacyAdmin.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
      console.log('[Seed] Legacy admin password set/reset')
    }

    await legacyAdmin.save()
    console.log(`[Seed] Migrated legacy admin -> loginId: ${chosenId} | name: ${ADMIN_NAME}`)
    return
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
  admin = await User.create({
    loginId: ADMIN_ID,
    name: ADMIN_NAME,
    passwordHash,
    role: 'ADMIN',
    isGuest: false,
    isActive: true,
    kitchenId: null,
  })

  console.log(`[Seed] Admin created -> ID: ${ADMIN_ID} | Name: ${ADMIN_NAME} | Password: ${ADMIN_PASSWORD}`)
}

upsertAdmin()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('[Seed] Error:', err)
    process.exit(1)
  })
