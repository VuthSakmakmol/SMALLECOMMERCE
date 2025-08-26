import { defineStore } from 'pinia'
import api from '@/utils/api'

export const useAuth = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    loading: false,
    error: null
  }),
  getters: { isAuthed: s => !!s.token, role: s => s.user?.role || null },
  actions: {
    async login(email, password) {
      this.loading = true; this.error = null
      try {
        const { data } = await api.post('/auth/login', { email, password })
        this.token = data.token
        this.user = data.user
        localStorage.setItem('token', this.token)
        localStorage.setItem('user', JSON.stringify(this.user))
        return true
      } catch (e) {
        this.error = e?.response?.data?.message || 'Login failed'
        return false
      } finally { this.loading = false }
    },
    logout() {
      this.token = null; this.user = null
      localStorage.removeItem('token'); localStorage.removeItem('user')
    }
  }
})
