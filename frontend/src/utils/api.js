// frontend/src/utils/api.js
import axios from 'axios'

// prefer environment variable, fallback to your server IP
// const baseURL = import.meta.env.VITE_API_URL || 'http://159.65.14.57:4310/api'
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4310/api'
console.log('[API baseURL]', baseURL)

const api = axios.create({ baseURL })

// Attach token if exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default api
