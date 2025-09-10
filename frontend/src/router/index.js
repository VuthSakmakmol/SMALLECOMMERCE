// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/store/auth'

// Eager imports (you already had these)
import AdminPackages from '@/views/admin/AdminPackages.vue'
import ChefPackages from '@/views/chef/ChefPackages.vue'
import CustomerPackages from '@/views/customer/CustomerPackages.vue'

// Lazy imports
// Auth
const Login = () => import('@/views/Login.vue')

// Admin layout + pages
const AdminLayout       = () => import('@/layouts/AdminLayout.vue')
const AdminDashboard    = () => import('@/views/admin/AdminDashboard.vue')
const AdminCategories   = () => import('@/views/admin/AdminCategories.vue')
const AdminFoods        = () => import('@/views/admin/AdminFoods.vue')
const AdminOrders       = () => import('@/views/admin/AdminOrders.vue')
const AdminUsers        = () => import('@/views/admin/AdminUsers.vue')
const AdminIngredients  = () => import('@/views/admin/AdminIngredients.vue')
const AdminChoiceGroups = () => import('@/views/admin/AdminChoiceGroups.vue')

// Chef layout + pages
const ChefLayout        = () => import('@/layouts/ChefLayout.vue')
const ChefOrders        = () => import('@/views/chef/ChefOrders.vue')
const ChefCategories    = () => import('@/views/chef/ChefCategories.vue')
const ChefFoods         = () => import('@/views/chef/ChefFoods.vue')
const ChefAvailability  = () => import('@/views/chef/ChefAvailability.vue')

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

    // ADMIN
    {
      path: '/admin',
      component: AdminLayout,
      meta: { role: 'ADMIN' },
      children: [
        { path: '',              name: 'admin-dashboard',    component: AdminDashboard,    meta: { title: 'Overview' } },
        { path: 'categories',    name: 'admin-categories',   component: AdminCategories,   meta: { title: 'Categories' } },
        { path: 'packages',      name: 'admin-packages',     component: AdminPackages,     meta: { title: 'Packages' } },
        { path: 'foods',         name: 'admin-foods',        component: AdminFoods,        meta: { title: 'Foods' } },
        { path: 'ingredients',   name: 'admin-ingredients',  component: AdminIngredients,  meta: { title: 'Ingredients' } },
        { path: 'choice-groups', name: 'admin-choice-groups',component: AdminChoiceGroups, meta: { title: 'Choice Groups' } },
        { path: 'orders',        name: 'admin-orders',       component: AdminOrders,       meta: { title: 'Orders' } },
        { path: 'users',         name: 'admin-users',        component: AdminUsers,        meta: { title: 'Users' } },
      ]
    },

    // CHEF
    {
      path: '/chef',
      component: ChefLayout,
      meta: { role: 'CHEF' },
      children: [
        { path: '',              name: 'chef-orders',       component: ChefOrders },
        { path: 'categories',    name: 'chef-categories',   component: ChefCategories },
        { path: 'foods',         name: 'chef-foods',        component: ChefFoods },
        { path: 'availability',  name: 'chef-availability', component: ChefAvailability },
        { path: 'packages',      name: 'chef-packages',     component: ChefPackages },
      ]
    },

    // CUSTOMER
    {
      path: '/customer',
      component: CustomerLayout,
      meta: { role: 'CUSTOMER' },
      children: [
        { path: '',            name: 'customer-browse',    component: CustomerBrowse },
        { path: 'packages',    name: 'customer-packages',  component: CustomerPackages },
        { path: 'categories',  name: 'customer-categories',component: CustomerCategories },
        { path: 'history',     name: 'customer-history',   component: CustomerHistory },
      ]
    },

    // 404
    { path: '/:pathMatch(.*)*', redirect: '/login' }
  ]
})

// RBAC guard
router.beforeEach((to) => {
  const auth = useAuth()

  // Allow login freely
  if (to.name === 'login') return true

  // Must be authed
  if (!auth.isAuthed) {
    return { name: 'login', query: { next: to.fullPath } }
  }

  // Role gate
  const need = to.meta.role
  if (need && auth.role !== need) {
    if (auth.role === 'ADMIN') return { name: 'admin-dashboard' }
    if (auth.role === 'CHEF')  return { name: 'chef-orders' }
    return { name: 'customer-browse' }
  }

  return true
})

export default router
