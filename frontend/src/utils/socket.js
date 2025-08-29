

import { io } from 'socket.io-client'

// const url = import.meta.env.VITE_SOCKET_URL || 'http://159.65.14.57:4310'
const url = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4310'
const socket = io(url, {
  autoConnect: false,
  transports: ['websocket'],
  auth: cb => cb({ token: localStorage.getItem('token') || null }),
})

socket.on('connect', () => console.log('[socket] connected', socket.id))
socket.on('connect_error', e => console.warn('[socket] connect_error:', e?.message))

export default socket
