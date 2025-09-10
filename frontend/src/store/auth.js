import { defineStore } from 'pinia'
import api from '@/utils/api' // your axios instance


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
    _setAuth(token, user) {
      this.token = token
      this.user = user
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    _clear() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },

    async login(id, password) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post('/auth/login', { id, password })
        this._setAuth(data.token, data.user)
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || 'Login failed'
        this._clear()
        return false
      } finally { this.loading = false }
    },

    async registerGuest({ password, displayName, fromCompany }) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post('/auth/register-guest', { password, displayName, fromCompany })
        this._setAuth(data.token, data.user)
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || 'Register failed'
        this._clear()
        return false
      } finally { this.loading = false }
    },


    async registerCustomer({ id, username, password }) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post('/auth/register', { id, username, password })
        this._setAuth(data.token, data.user)
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || 'Register failed'
        this._clear()
        return false
      } finally { this.loading = false }
    },

    logout() { this._clear() },

    // optional: refresh /me
    async fetchMe() {
      if (!this.token) return
      this.loading = true; this.error = null
      try {
        const { data } = await api.get('/auth/me')
        this.user = data.user
        localStorage.setItem('user', JSON.stringify(this.user))
      } catch (e) {
        this._clear()
      } finally { this.loading = false }
    }
  }
})
