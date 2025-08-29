<script setup>
import { ref, computed } from 'vue'
import { useAuth } from '@/store/auth'
import { useRouter, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'

const drawer = ref(true)
const rail = ref(false)
const auth = useAuth()
const router = useRouter()
const route = useRoute()
const { smAndDown, mdAndUp } = useDisplay()

const items = [
  { to: '/admin',            text: 'Dashboard',  icon: 'mdi-view-dashboard' },
  { to: '/admin/categories', text: 'Categories', icon: 'mdi-shape' },
  { to: '/admin/foods',      text: 'Foods',      icon: 'mdi-silverware-fork-knife' },
  { to: '/admin/packages',   text: 'Packages',   icon: 'mdi-briefcase-variant' },
  { to: '/admin/orders',     text: 'Orders',     icon: 'mdi-receipt-text' },
  { to: '/admin/users',      text: 'Users',      icon: 'mdi-account-group' },
]

const isActive = (to) => route.path === to
const logout = () => { auth.logout(); router.push('/login') }

// Drawer widths (match Vuetify defaults)
const FULL_W = 256
const RAIL_W = 72

// Compute the left offset for desktop so content never hides
const leftOffset = computed(() => {
  if (!mdAndUp.value) return 0
  if (!drawer.value)  return 0
  return rail.value ? RAIL_W : FULL_W
})
</script>

<template>
  <v-layout>
    <v-navigation-drawer
      v-model="drawer"
      :permanent="mdAndUp"
      :temporary="smAndDown"
      :rail="mdAndUp ? rail : false"
      location="left"
      :width="256"
      :rail-width="72"
    >
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
          active-color="orange"
          rounded="lg"
          nav
        />

        <v-list-item @click="logout">
          <template #prepend><v-icon color="red">mdi-logout</v-icon></template>
          <v-list-item-title class="text-red">Sign out</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Offset the app bar so it never sits under the drawer on desktop -->
    <v-app-bar
      flat
      :style="{
        left: leftOffset + 'px',
        width: `calc(100% - ${leftOffset}px)`
      }"
    >
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Admin</v-toolbar-title>
      <v-spacer />
      <span v-if="auth.role === 'ADMIN'">{{ auth.user?.name }}</span>
      <v-btn v-if="mdAndUp" icon @click="rail = !rail">
        <v-icon>mdi-arrow-expand-left</v-icon>
      </v-btn>
    </v-app-bar>

    <!-- Offset main content too -->
    <v-main
      class="pa-4"
      :style="{ marginLeft: leftOffset + 'px' }"
    >
      <RouterView />
    </v-main>
  </v-layout>
</template>
