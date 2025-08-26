// server/src/seed.js

const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const dotenv = require('dotenv')
const User = require('./models/User')

dotenv.config()

const MONGODB_URI = process.env.MONGODB_URI

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('[MongoDB] Connected for seeding')

    const email = 'admin@example.com'
    const password = 'admin123'
    const name = 'Super Admin'

    // Check if admin already exists
    let admin = await User.findOne({ email })
    if (admin) {
      console.log('[Seed] Admin already exists:', admin.email)
    } else {
      const passwordHash = await bcrypt.hash(password, 10)
      admin = new User({
        name,
        email,
        passwordHash,
        role: 'ADMIN',
        isActive: true
      })
      await admin.save()
      console.log(`[Seed] Admin created -> email: ${email} | password: ${password}`)
    }

    process.exit(0)
  } catch (err) {
    console.error('[Seed] Error:', err)
    process.exit(1)
  }
}

seedAdmin()
