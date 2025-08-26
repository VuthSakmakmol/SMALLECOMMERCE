import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/store/auth'

const Login           = () => import('@/views/Login.vue')
const AdminLayout     = () => import('@/layouts/AdminLayout.vue')
const AdminDashboard  = () => import('@/views/admin/AdminDashboard.vue')
const AdminCategories = () => import('@/views/admin/AdminCategories.vue')
const AdminFoods      = () => import('@/views/admin/AdminFoods.vue')
const AdminOrders     = () => import('@/views/admin/AdminOrders.vue')
const AdminUsers      = () => import('@/views/admin/AdminUsers.vue')

const ChefHome       = () => import('@/views/chef/ChefHome.vue')
const CustomerHome   = () => import('@/views/customer/CustomerHome.vue')

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/login' },
    { path: '/login', name: 'login', component: Login },

    // ADMIN with sidebar
    {
      path: '/admin',
      component: AdminLayout,
      meta: { role: 'ADMIN' },
      children: [
        { path: '',            name: 'admin-dashboard', component: AdminDashboard },
        { path: 'categories',  name: 'admin-categories', component: AdminCategories },
        { path: 'foods',       name: 'admin-foods',      component: AdminFoods },
        { path: 'orders',      name: 'admin-orders',     component: AdminOrders },
        { path: 'users',       name: 'admin-users',      component: AdminUsers },
      ]
    },

    { path: '/chef',     name: 'chef',     component: ChefHome,     meta: { role: 'CHEF' } },
    { path: '/customer', name: 'customer', component: CustomerHome, meta: { role: 'CUSTOMER' } },
  ]
})

// simple RBAC guard
router.beforeEach((to) => {
  const auth = useAuth()
  if (to.path === '/login') return true
  if (!auth.isAuthed) return { name: 'login' }

  const need = to.meta.role
  if (need && auth.role !== need) {
    if (auth.role === 'ADMIN')   return { name: 'admin-dashboard' }
    if (auth.role === 'CHEF')    return { name: 'chef' }
    return { name: 'customer' }
  }
  return true
})

export default router
