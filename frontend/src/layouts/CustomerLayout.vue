<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/store/auth'
import { useDisplay } from 'vuetify'

const drawer = ref(true)
const rail   = ref(false)

const router = useRouter()
const route  = useRoute()
const auth   = useAuth()
const { smAndDown, mdAndUp } = useDisplay()

const items = [
  { to: '/customer',             text: 'Browse',     icon: 'mdi-store' },
  { to: '/customer/packages',    text: 'Packages',   icon: 'mdi-store' },
  { to: '/customer/categories',  text: 'Categories', icon: 'mdi-shape' },
  { to: '/customer/history',     text: 'History',    icon: 'mdi-history' },
]

const isActive = (to) => route.path === to
const logout = () => { auth.logout(); router.push('/login') }

// Drawer widths (match Vuetify defaults)
const FULL_W = 256
const RAIL_W = 72

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
        <v-list-item title="Small E-Commerce" subtitle="Customer" />
        <v-divider />
        <v-list-item
          v-for="it in items"
          :key="it.to"
          :to="it.to"
          :title="it.text"
          :prepend-icon="it.icon"
          :active="isActive(it.to)"
          active-color="orange"
          rounded="lg"
          nav
        />
        <v-divider class="my-2" />
        <v-list-item @click="logout">
          <template #prepend><v-icon color="red">mdi-logout</v-icon></template>
          <v-list-item-title class="text-red">Sign out</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>

    <v-app-bar
      flat
      :style="{ left: leftOffset + 'px', width: `calc(100% - ${leftOffset}px)` }"
    >
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-toolbar-title>Customer</v-toolbar-title>
      <v-spacer />
      <v-btn v-if="mdAndUp" icon @click="rail = !rail">
        <v-icon>mdi-arrow-expand-left</v-icon>
      </v-btn>
    </v-app-bar>

    <v-main class="pa-4" :style="{ marginLeft: leftOffset + 'px' }">
      <RouterView />
    </v-main>
  </v-layout>
</template>
