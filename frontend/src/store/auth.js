import { defineStore } from 'pinia'
import api from '@/utils/api'

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    loading: false,
    error: null,
  }),
  getters: {
    isAuthed: s => !!s.token,
    role: s => s.user?.role || null,
    name: s => s.user?.name || '',
  },
  actions: {
    setSession(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    clearSession() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },
    async login(username, password) {
      this.loading = true
      this.error = null
      try {
        const { data } = await api.post('/auth/login', { username, password })
        this.setSession(data.token, data.user)
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || e?.message || 'Login failed'
        return false
      } finally {
        this.loading = false
      }
    },
    async register(username, password) {
      this.loading = true
      this.error = null
      try {
        // backend register expects username+password and returns token+user
        const { data } = await api.post('/auth/register', { username, password })
        this.setSession(data.token, data.user)
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || e?.message || 'Registration failed'
        return false
      } finally {
        this.loading = false
      }
    },
    logout() { this.clearSession() }
  }
})
