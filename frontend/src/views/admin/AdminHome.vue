<script setup>
import { onMounted, ref, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const health  = ref(null)
const counts  = ref({ categories: 0, foods: 0, packages: 0, activeOrders: 0 })

const healthPretty = computed(() => JSON.stringify(health.value, null, 2))

async function fetchData() {
  loading.value = true
  try {
    const [h, cats, foods, packs, orders] = await Promise.all([
      api.get('/health'),
      api.get('/categories'),
      api.get('/foods'),
      api.get('/packages'),
      api.get('/orders', { params: { status: 'ACTIVE' } })
    ])
    health.value = h.data
    counts.value = {
      categories: (cats.data?.data ?? cats.data)?.length ?? 0,
      foods:      (foods.data?.data ?? foods.data)?.length ?? 0,
      packages:   (packs.data?.data ?? packs.data)?.length ?? 0,
      activeOrders: (orders.data ?? []).length ?? 0,
    }
  } finally { loading.value = false }
}

onMounted(fetchData)
</script>

<template>
  <v-container fluid>
    <v-row class="mb-4">
      <v-col cols="12">
        <div class="text-h5 font-weight-medium">Overview</div>
        <div class="text-body-2 text-medium-emphasis">Quick look at today’s system status</div>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="text-overline">Categories</div>
          <div class="text-h5">{{ counts.categories }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="text-overline">Foods</div>
          <div class="text-h5">{{ counts.foods }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="text-overline">Packages</div>
          <div class="text-h5">{{ counts.packages }}</div>
        </v-card>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-card class="pa-4">
          <div class="text-overline">Active Orders</div>
          <div class="text-h5">{{ counts.activeOrders }}</div>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-2">
      <v-col cols="12" md="8">
        <v-card class="pa-4">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="text-subtitle-1">Shortcuts</div>
            <v-btn size="small" variant="text" :loading="loading" @click="fetchData">Refresh</v-btn>
          </div>
          <v-btn class="mr-2 mb-2" color="primary" to="/admin/orders"   prepend-icon="mdi-receipt-text-outline">Orders</v-btn>
          <v-btn class="mr-2 mb-2" color="primary" to="/admin/categories" prepend-icon="mdi-shape-outline">Categories</v-btn>
          <v-btn class="mr-2 mb-2" color="primary" to="/admin/foods"    prepend-icon="mdi-food">Foods</v-btn>
          <v-btn class="mr-2 mb-2" color="primary" to="/admin/packages" prepend-icon="mdi-package-variant-closed">Packages</v-btn>
          <v-btn class="mr-2 mb-2" variant="tonal" to="/admin/users"    prepend-icon="mdi-account-group-outline">Users</v-btn>
          <v-btn class="mr-2 mb-2" variant="tonal" to="/admin/reports"  prepend-icon="mdi-chart-box-outline">Reports</v-btn>
        </v-card>
      </v-col>

      <v-col cols="12" md="4">
        <v-card class="pa-4">
          <div class="text-subtitle-1 mb-2">API Health</div>
          <v-skeleton-loader v-if="loading" type="article" />
          <pre v-else class="text-body-2" style="white-space:pre-wrap">{{ healthPretty }}</pre>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
