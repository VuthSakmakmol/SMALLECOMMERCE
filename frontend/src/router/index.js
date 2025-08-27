// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/store/auth'
import AdminPackages from '../views/admin/AdminPackages.vue'
import ChefPackages from '../views/chef/ChefPackages.vue'
import CustomerPackages from '../views/customer/CustomerPackages.vue'

// Auth
const Login = () => import('@/views/Login.vue')

// Admin layout + pages
const AdminLayout     = () => import('@/layouts/AdminLayout.vue')
const AdminDashboard  = () => import('@/views/admin/AdminDashboard.vue')
const AdminCategories = () => import('@/views/admin/AdminCategories.vue')
const AdminFoods      = () => import('@/views/admin/AdminFoods.vue')
const AdminOrders     = () => import('@/views/admin/AdminOrders.vue')
const AdminUsers      = () => import('@/views/admin/AdminUsers.vue')

// Chef layout + pages
const ChefLayout      = () => import('@/layouts/ChefLayout.vue')
const ChefOrders      = () => import('@/views/chef/ChefOrders.vue')
const ChefCategories  = () => import('@/views/chef/ChefCategories.vue')
const ChefFoods       = () => import('@/views/chef/ChefFoods.vue')
const ChefAvailability= () => import('@/views/chef/ChefAvailability.vue')

// Customer layout + pages
const CustomerLayout     = () => import('@/layouts/CustomerLayout.vue')
const CustomerBrowse     = () => import('@/views/customer/CustomerBrowse.vue')
const CustomerCategories = () => import('@/views/customer/CustomerCategories.vue')
const CustomerHistory    = () => import('@/views/customer/CustomerHistory.vue')

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
        { path: '',            name: 'admin-dashboard',  component: AdminDashboard },
        { path: 'categories',  name: 'admin-categories', component: AdminCategories },
        { path: 'packages',    name: 'admin-packages',   component: AdminPackages},
        { path: 'foods',       name: 'admin-foods',      component: AdminFoods },
        { path: 'orders',      name: 'admin-orders',     component: AdminOrders },
        { path: 'users',       name: 'admin-users',      component: AdminUsers },
      ]
    },

    // CHEF with sidebar
    {
      path: '/chef',
      component: ChefLayout,
      meta: { role: 'CHEF' },
      children: [
        { path: '',              name: 'chef-orders',       component: ChefOrders },
        { path: 'categories',    name: 'chef-categories',   component: ChefCategories },
        { path: 'foods',         name: 'chef-foods',        component: ChefFoods },
        { path: 'availability',  name: 'chef-availability', component: ChefAvailability },
        { path: 'packages',      name: 'chef-packages',     component: ChefPackages}
      ]
    },

    {
      path: '/customer',
      component: CustomerLayout,
      meta: { role: 'CUSTOMER' },
      children: [
        { path: '',            name: 'customer-browse',     component: CustomerBrowse },
        { path: 'packages',    name: 'customer-packages',    component: CustomerPackages},
        { path: 'categories',  name: 'customer-categories', component: CustomerCategories },
        { path: 'history',     name: 'customer-history',    component: CustomerHistory },
      ]
    },
    // 404 fallback
    { path: '/:pathMatch(.*)*', redirect: '/login' }
  ]
})

// simple RBAC guard
router.beforeEach((to) => {
  const auth = useAuth()
  if (to.path === '/login') return true
  if (!auth.isAuthed) return { name: 'login' }

  const need = to.meta.role
  if (need && auth.role !== need) {
    if (auth.role === 'ADMIN') return { name: 'admin-dashboard' }
    if (auth.role === 'CHEF')  return { name: 'chef-orders' }
    return { name: 'customer' }
  }
  return true
})

export default router
