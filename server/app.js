// server/app.js
const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

/* ───────────────────────── Uncaught/Unhandled ───────────────────────── */
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
});
process.on('unhandledRejection', (reason, p) => {
  console.error('[Unhandled Rejection]', reason);
});

/* ───────────────────────── Env ───────────────────────── */
const PORT = process.env.PORT || 4310;
const NODE_ENV = process.env.NODE_ENV || 'development';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*'; // lock to your origin later

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not defined in .env');
  process.exit(1);
}

/* ───────────────────────── App + Server ───────────────────────── */
const app = express();
const server = http.createServer(app);

/* ───────────────────────── Socket.IO ───────────────────────── */
const io = new Server(server, {
  cors: { origin: FRONTEND_ORIGIN, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
  path: '/socket.io',
});
io.on('connection', (socket) => {
  console.log('📡 WebSocket connected:', socket.id);

  socket.on('join', ({ role, userId, kitchenId, groupKey }) => {
    if (role === 'ADMIN') socket.join('room:admin');
    if (role === 'CHEF') {
      socket.join('room:chef');
      socket.join(`room:chef:${kitchenId || 'default'}`);
    }
    if (role === 'CUSTOMER' && userId) socket.join(`room:customer:${userId}`);
    if (groupKey) socket.join(`room:group:${groupKey}`);
  });

  socket.on('join-order', ({ orderId }) => orderId && socket.join(`room:order:${orderId}`));

  socket.on('disconnect', () => console.log('❌ WebSocket disconnected:', socket.id));
});
app.set('io', io);

/* ───────────────────────── Middleware (ORDER MATTERS) ───────────────────────── */
// 1) CORS first
app.use(cors({ origin: FRONTEND_ORIGIN }));

// 2) Body parsers (large limits if you upload images/files)
app.use(express.json({ limit: '800mb' }));
app.use(express.urlencoded({ limit: '800mb', extended: true }));

// 3) Static buckets (uploads/public)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/public', express.static(path.join(__dirname, 'public')));

/* ───────────────────────── API Routes ───────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    env: NODE_ENV,
    mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    time: new Date().toISOString(),
  });
});

// mount your routers
app.use('/api/auth', require('./src/routes/auth.routes'));
app.use('/api/orders', require('./src/routes/orders.routes'));
app.use('/api/categories', require('./src/routes/categories.routes'));
app.use('/api/foods', require('./src/routes/foods.routes'));
app.use('/api/users', require('./src/routes/users.routes'));
app.use('/api/packages', require('./src/routes/packages.routes'));
app.use('/api/reports', require('./src/routes/reports.routes'));
app.use('/api/ingredients', require('./src/routes/ingredients.routes'))
app.use('/api/choice-groups', require('./src/routes/choice-groups.routes'))
app.use('/api/cart', require('./src/routes/cart.routes'))


/* ───────────────────────── Error logger (AFTER routes) ───────────────────────── */
app.use((err, req, res, next) => {
  console.error('[Backend Error]', {
    method: req.method,
    url: req.originalUrl,
    message: err?.message,
    stack: err?.stack,
  });
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server error',
  });
});

/* ───────────────────────── Frontend SPA (LAST) ───────────────────────── */
const FRONT_DIST = path.join(__dirname, '../frontend/dist');
app.use(express.static(FRONT_DIST));
// SPA fallback — keep this LAST handler
app.get(/.*/, (req, res) => res.sendFile(path.join(FRONT_DIST, 'index.html')));

/* ───────────────────────── Mongo + Start ───────────────────────── */
mongoose.set('strictQuery', true);
mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));

/* ───────────────────────── Graceful shutdown ───────────────────────── */
const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down...`);
  try {
    await mongoose.connection.close();
    server.close(() => {
      console.log('🛑 HTTP server closed');
      process.exit(0);
    });
  } catch (e) {
    console.error('Forced shutdown', e);
    process.exit(1);
  }
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
