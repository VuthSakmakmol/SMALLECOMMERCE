const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const User = require('./models/User') 
dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('[Seed] Missing MONGODB_URI in .env')
  process.exit(1)
}

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('[MongoDB] Connected for seeding')

    const ADMIN_NAME = process.env.ADMIN_NAME || 'admin'
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'

    let admin = await User.findOne({ name: ADMIN_NAME })
    if (admin) {
      console.log(`[Seed] Admin already exists: ${admin.name}`)
    } else {
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10)
      admin = await User.create({
        name: ADMIN_NAME,
        passwordHash,
        role: 'ADMIN',
        isActive: true,
      })
      console.log(`[Seed] Admin created -> username: ${ADMIN_NAME} | password: ${ADMIN_PASSWORD}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('[Seed] Error:', err)
    process.exit(1)
  }
}

seedAdmin()
