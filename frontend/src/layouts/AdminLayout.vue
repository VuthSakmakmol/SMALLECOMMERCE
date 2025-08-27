<script setup>
import { ref, computed } from 'vue'
import { useAuth } from '@/store/auth'
import { useRouter, useRoute } from 'vue-router'

const drawer = ref(true)
const rail = ref(false)
const auth = useAuth()
const router = useRouter()
const route = useRoute()

const items = [
  { to: '/admin',            text: 'Dashboard',  icon: 'mdi-view-dashboard' },
  { to: '/admin/categories', text: 'Categories', icon: 'mdi-shape' },
  { to: '/admin/foods',      text: 'Foods',      icon: 'mdi-silverware-fork-knife' },
  { to: '/admin/packages',   text: 'Packages',   icon: 'mdi-briefcase-variant' }, // NEW
  { to: '/admin/orders',     text: 'Orders',     icon: 'mdi-receipt-text' },
  { to: '/admin/users',      text: 'Users',      icon: 'mdi-account-group' },
]

const isActive = (to) => route.path === to
const logout = () => { auth.logout(); router.push('/login') }
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list density="compact" nav>
        <v-list-item title="Small E-Commerce" subtitle="Admin" />
        <v-divider />
        <v-list-item
            v-for="it in items"
            :key="it.to"
            :to="it.to"
            :prepend-icon="it.icon"
            :title="it.text"     
            :active="isActive(it.to)"
            rounded="lg"
            nav
        />

        <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="logout" />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Admin</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="rail = !rail"><v-icon>mdi-arrow-expand-left</v-icon></v-btn>
    </v-app-bar>

    <v-main class="pa-4">
      <RouterView />
    </v-main>
  </v-app>
</template>
