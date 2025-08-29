// frontend/src/utils/socket.js
import { io } from 'socket.io-client'

// const url = import.meta.env.VITE_SOCKET_URL || 'http://159.65.14.57:4310'
const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4310'
// single shared socket instance
const socket = io(url, {
  autoConnect: false,            // you decide when to connect
  transports: ['websocket'],     // skip long-polling in prod
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  // send JWT (if you have one) with each connection
  auth: cb => {
    const token = localStorage.getItem('token') || null
    cb({ token })
  },
})

/* helpful logs (optional) */
socket.on('connect',       () => console.log('[socket] connected', socket.id))
socket.on('disconnect',    (r) => console.log('[socket] disconnected', r))
socket.on('reconnect',     (n) => console.log('[socket] reconnected', n))
socket.on('connect_error', (e) => console.warn('[socket] connect_error:', e?.message))

export default socket
