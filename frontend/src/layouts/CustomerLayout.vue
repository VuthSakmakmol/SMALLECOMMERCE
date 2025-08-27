<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/store/auth'

const drawer = ref(true)
const rail = ref(false)
const router = useRouter()
const route = useRoute()
const auth = useAuth()

const items = [
  { to: '/customer',            text: 'Browse',     icon: 'mdi-store' },
  { to: '/customer/packages',    text: 'Packages',   icon: 'mdi-store'},
  { to: '/customer/categories', text: 'Categories', icon: 'mdi-shape' },
  { to: '/customer/history',    text: 'History',    icon: 'mdi-history' },
]
const isActive = (to) => route.path === to
const logout = () => { auth.logout(); router.push('/login') }
</script>

<template>
  <v-app>
    <v-navigation-drawer v-model="drawer" :rail="rail" permanent>
      <v-list density="compact" nav>
        <v-list-item title="Small E-Commerce" subtitle="Customer" />
        <v-divider />
        <v-list-item
          v-for="it in items" :key="it.to"
          :to="it.to" :title="it.text" :prepend-icon="it.icon"
          :active="isActive(it.to)" rounded="lg" nav
        />
        <v-divider class="my-2" />
        <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="logout" />
      </v-list>
    </v-navigation-drawer>

    <v-app-bar flat>
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Customer</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="rail = !rail"><v-icon>mdi-arrow-expand-left</v-icon></v-btn>
    </v-app-bar>

    <v-main class="pa-4">
      <RouterView />
    </v-main>
  </v-app>
</template>
