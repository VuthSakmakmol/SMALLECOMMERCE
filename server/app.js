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


// Endpoint
// at the top of app.js (after express/json)
const authRoutes  = require('./src/routes/auth.routes')
const orderRoutes = require('./src/routes/orders.routes')  // plural
const categoryRoutes = require('./src/routes/categories.routes')
const foodRoutes     = require('./src/routes/foods.routes')


app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/foods', foodsRoutes = foodRoutes) // (keep /api/foods path the same)



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
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
})

io.on('connection', (socket) => {
  console.log('[Socket] client connected:', socket.id)

  // Example room join
  socket.on('join', ({ role, userId, kitchenId }) => {
    if (role === 'ADMIN') socket.join('room:admin')
    if (role === 'CHEF' && kitchenId) socket.join(`room:chef:${kitchenId}`)
    if (role === 'CUSTOMER' && userId) socket.join(`room:customer:${userId}`)
    console.log('[Socket] joined rooms:', [...socket.rooms])
  })

  socket.on('disconnect', () => {
    console.log('[Socket] client disconnected:', socket.id)
  })
})

app.set('io', io)

/* ───────────────────────────────
   Routes
──────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString()
  })
})

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
