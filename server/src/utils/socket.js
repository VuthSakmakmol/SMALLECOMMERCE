// src/utils/socket.js (example)
import { io } from 'socket.io-client'
const socket = io(import.meta.env.VITE_API_URL, {
  autoConnect: false,
  transports: ['websocket']
})

export function connectAsCustomer(userId, groupKey) {
  if (!socket.connected) socket.connect()
  socket.emit('join', { role: 'CUSTOMER', userId, groupKey })
}

export function joinOrder(orderId) {
  socket.emit('join-order', { orderId })
}

socket.on('order:new', (order) => { /* update UI */ })
socket.on('order:status', (order) => { /* update UI */ })
socket.on('order:completed', (order) => { /* update UI */ })

export default socket
