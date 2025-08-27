// server/app.js
const express = require('express')
const http = require('http')
const cors = require('cors')
const mongoose = require('mongoose')
const dotenv = require('dotenv')

// Load .env
dotenv.config()

/* ───────────────────────────────
   Env variables
──────────────────────────────── */
const PORT = process.env.PORT || 5000
const MONGODB_URI = process.env.MONGODB_URI
const NODE_ENV = process.env.NODE_ENV || 'development'

if (!MONGODB_URI) {
  console.error('[Error] MONGODB_URI is not defined in .env')
  process.exit(1)
}

const app = express()
app.use(cors())
app.use(express.json())

/* ───────────────────────────────
   MongoDB connection
──────────────────────────────── */
mongoose.set('strictQuery', true)
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log('[MongoDB] Connected successfully'))
  .catch(err => {
    console.error('[MongoDB] Connection error:', err.message)
    process.exit(1)
  })

/* ───────────────────────────────
   HTTP server + Socket.IO
──────────────────────────────── */
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, {
  cors: {
    origin: '*', // TODO: restrict to your frontend origin in production
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
})

io.on('connection', (socket) => {
  // role = ADMIN | CHEF | CUSTOMER
  // userId: for customers
  // kitchenId: for chefs (optional)
  // groupKey: table/room key (optional)
  socket.on('join', ({ role, userId, kitchenId, groupKey }) => {
    if (role === 'ADMIN') {
      socket.join('room:admin')
    }
    if (role === 'CHEF') {
      socket.join('room:chef') // global room for all chefs
      socket.join(`room:chef:${kitchenId || 'default'}`)
    }
    if (role === 'CUSTOMER' && userId) {
      socket.join(`room:customer:${userId}`)
    }
    if (groupKey) {
      socket.join(`room:group:${groupKey}`)
    }
  })

  // let the client subscribe to a specific order
  socket.on('join-order', ({ orderId }) => {
    if (orderId) socket.join(`room:order:${orderId}`)
  })
})

app.set('io', io)

/* ───────────────────────────────
   Routes
──────────────────────────────── */
const authRoutes     = require('./src/routes/auth.routes')
const orderRoutes    = require('./src/routes/orders.routes')     // plural
const categoryRoutes = require('./src/routes/categories.routes')
const foodRoutes     = require('./src/routes/foods.routes')
const userRoutes     = require('./src/routes/users.routes')
const packageRoutes  = require('./src/routes/packages.routes')   // NEW (workshop bundles)

app.use('/api/health', (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/foods', foodRoutes) // fixed typo
app.use('/api/users', userRoutes)
app.use('/api/packages', packageRoutes) // NEW

/* ───────────────────────────────
   Global error handler
──────────────────────────────── */
app.use((err, req, res, next) => {
  console.error('[Error]', err)
  res.status(err.status || 500).json({
    message: err.message || 'Server error',
    details: err.details || null
  })
})

/* ───────────────────────────────
   Start server
──────────────────────────────── */
server.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`)
})
