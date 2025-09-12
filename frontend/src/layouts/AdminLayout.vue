<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/store/auth'

const router = useRouter()
const route  = useRoute()
const auth   = useAuth()

const drawer = ref(true)

// AdminLayout.vue
const links = [
  { to: '/admin',            text: 'Dashboard',  icon: 'mdi-home-outline' }, // ← was "Overview"
  { to: '/admin/orders',     text: 'Orders',    icon: 'mdi-receipt-text-outline' },
  { to: '/admin/categories', text: 'Categories',icon: 'mdi-shape-outline' },
  { to: '/admin/ingredients',      text: 'Incredient',     icon: 'mdi-food-apple-outline' },
  { to: '/admin/choice-groups',      text: 'Choice-group',     icon: 'mdi-shape-outline' },
  { to: '/admin/foods',      text: 'Foods',     icon: 'mdi-food' },
  { to: '/admin/packages',   text: 'Packages',  icon: 'mdi-package-variant-closed' },
  { to: '/admin/users',      text: 'Users',     icon: 'mdi-account-group-outline' },
]


function routeByRole(role) {
  if (role === 'ADMIN') return
  if (role === 'CHEF') router.replace('/chef')
  else router.replace('/customer')
}

function go(path) { router.push(path) }
function logout() { auth.logout(); router.replace('/auth') }

const title = computed(() => route.meta?.title || 'Admin')

onMounted(() => {
  if (!auth.isAuthed) return router.replace('/auth')
  routeByRole(auth.role)
})
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" app>
      <v-list density="comfortable" nav>
        <v-list-item
          v-for="l in links" :key="l.to"
          :to="l.to" :active="route.path === l.to" @click="go(l.to)"
          :prepend-icon="l.icon" :title="l.text" />
      </v-list>
      <v-divider class="my-2" />
      <v-list>
        <v-list-item
          prepend-icon="mdi-logout" title="Logout" @click="logout" />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar app density="comfortable">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>{{ title }}</v-toolbar-title>
      <v-spacer />
      <div class="mr-4 text-caption text-medium-emphasis">
        {{ auth.user?.name }} ({{ auth.role || '—' }})
      </div>
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>
