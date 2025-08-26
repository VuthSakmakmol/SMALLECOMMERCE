// src/store/auth.js
import { defineStore } from 'pinia'
import api from '@/utils/api'
import socket from '@/utils/socket'

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
  },
  actions: {
    _attachToken() {
      if (this.token) api.defaults.headers.common['Authorization'] = `Bearer ${this.token}`
      else delete api.defaults.headers.common['Authorization']
    },
    _joinSocket() {
      if (!this.user) return
      if (!socket.connected) socket.connect()
      socket.emit('join', {
        role: this.user.role,
        userId: this.user._id,
        kitchenId: this.user.kitchenId || null,
      })
    },
    init() {
      // call once on app boot (see main.js note below)
      this._attachToken()
      if (this.token && this.user) this._joinSocket()
    },
    async login(email, password) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post('/auth/login', { email, password })
        this.token = data.token
        this.user  = data.user
        localStorage.setItem('token', this.token)
        localStorage.setItem('user', JSON.stringify(this.user))
        this._attachToken()
        this._joinSocket()
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || 'Login failed'
        return false
      } finally {
        this.loading = false
      }
    },
    logout() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      this._attachToken()
      try { if (socket.connected) socket.disconnect() } catch {}
    },
  },
})
