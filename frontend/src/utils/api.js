import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:4310/api'
console.log('[API baseURL]', baseURL) // see it in devtools once

const api = axios.create({ baseURL })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
