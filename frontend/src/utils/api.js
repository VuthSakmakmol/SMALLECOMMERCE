

import axios from 'axios'

// const baseURL = import.meta.env.VITE_API_URL || 'http://159.65.14.57:4310/api'
const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4310/api'
console.log('[API baseURL]', baseURL)

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use(cfg => {
  const t = localStorage.getItem('token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

export default api
