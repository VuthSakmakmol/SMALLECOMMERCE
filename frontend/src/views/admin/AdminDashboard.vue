<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'
import dayjs from 'dayjs'

const loading = ref(false)
const days = ref(14)
const data = ref(null)

async function load() {
  loading.value = true
  try {
    const { data: res } = await api.get('/reports/admin/summary', { params: { days: days.value } })
    data.value = res
  } finally {
    loading.value = false
  }
}

const statusTotals = computed(() => {
  const d = data.value?.distributions?.byStatus || []
  const sum = d.reduce((s, x) => s + x.count, 0) || 1
  return {
    sum,
    rows: d.map(x => ({
      label: x.status,
      count: x.count,
      pct: Math.round((x.count * 100) / sum)
    }))
  }
})

const typeTotals = computed(() => {
  const d = data.value?.distributions?.byType || []
  const sum = d.reduce((s, x) => s + x.count, 0) || 1
  return {
    sum,
    rows: d.map(x => ({
      label: x.type,
      count: x.count,
      pct: Math.round((x.count * 100) / sum)
    }))
  }
})

function statusColor(s) {
  return {
    PLACED: 'grey',
    ACCEPTED: 'primary',
    COOKING: 'deep-purple',
    READY: 'orange',
    DELIVERED: 'green',
    CANCELED: 'red'
  }[s] || 'grey'
}

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="white" density="comfortable" class="rounded-t-2xl">
      <template #append>
        <v-select
          :items="[7,14,30,60,90]"
          v-model="days"
          label="Days"
          variant="outlined"
          density="compact"
          style="max-width:120px"
          @update:modelValue="load"
          bg-color="orange"
          class="mt-7"
        />
        <v-btn class="ml-2" color="orange" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-progress-linear v-if="loading" indeterminate class="mb-4" />

      <!-- Summary cards -->
      <v-row dense>
        <v-col cols="12" md="3">
          <v-card color="primary" variant="tonal" class="rounded-xl left-accent-primary">
            <v-card-title class="text-caption text-medium-emphasis d-flex align-center justify-space-between">
              Total Orders
              <v-icon size="18" class="text-medium-emphasis">mdi-receipt-text</v-icon>
            </v-card-title>
            <v-card-text class="text-h4">
              {{ data?.cards?.orders?.total ?? '—' }}
            </v-card-text>
            <v-card-subtitle class="pb-3">Active: {{ data?.cards?.orders?.active ?? '—' }}</v-card-subtitle>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card color="success" variant="tonal" class="rounded-xl left-accent-success">
            <v-card-title class="text-caption text-medium-emphasis d-flex align-center justify-space-between">
              Today
              <v-icon size="18" class="text-medium-emphasis">mdi-calendar-today</v-icon>
            </v-card-title>
            <v-card-text class="text-h4">
              {{ data?.cards?.today?.total ?? '—' }}
            </v-card-text>
            <v-card-subtitle class="pb-3">
              Delivered: {{ data?.cards?.today?.delivered ?? '—' }} · Canceled: {{ data?.cards?.today?.canceled ?? '—' }}
            </v-card-subtitle>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card color="info" variant="tonal" class="rounded-xl left-accent-info">
            <v-card-title class="text-caption text-medium-emphasis d-flex align-center justify-space-between">
              Users
              <v-icon size="18" class="text-medium-emphasis">mdi-account-group</v-icon>
            </v-card-title>
            <v-card-text class="text-h4">
              {{ data?.cards?.users?.total ?? '—' }}
            </v-card-text>
            <v-card-subtitle class="pb-3">
              Active: {{ data?.cards?.users?.active ?? '—' }} · Admins: {{ data?.cards?.users?.admins ?? '—' }}
            </v-card-subtitle>
          </v-card>
        </v-col>

        <v-col cols="12" md="3">
          <v-card color="secondary" variant="tonal" class="rounded-xl left-accent-secondary">
            <v-card-title class="text-caption text-medium-emphasis d-flex align-center justify-space-between">
              Menu
              <v-icon size="18" class="text-medium-emphasis">mdi-silverware-fork-knife</v-icon>
            </v-card-title>
            <v-card-text class="text-h6">
              Foods: {{ data?.cards?.menu?.foods?.active ?? '—' }}/{{ data?.cards?.menu?.foods?.total ?? '—' }}
            </v-card-text>
            <v-card-subtitle class="pb-3">
              Packages: {{ data?.cards?.menu?.packages?.active ?? '—' }}/{{ data?.cards?.menu?.packages?.total ?? '—' }}
            </v-card-subtitle>
          </v-card>
        </v-col>
      </v-row>


      <!-- Distributions -->
      <v-row class="mt-2" dense>
        <v-col cols="12" md="6">
          <v-card class="rounded-xl">
            <v-card-title>By Status</v-card-title>
            <v-card-text>
              <div v-for="r in statusTotals.rows" :key="r.label" class="mb-2">
                <div class="d-flex justify-space-between">
                  <div>
                    <v-chip :color="statusColor(r.label)" label size="small" class="mr-2">{{ r.label }}</v-chip>
                    <small class="text-medium-emphasis">{{ r.count }}</small>
                  </div>
                  <small>{{ r.pct }}%</small>
                </div>
                <v-progress-linear :model-value="r.pct" :color="statusColor(r.label)" height="8" rounded />
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="rounded-xl">
            <v-card-title>By Order Type</v-card-title>
            <v-card-text>
              <div v-for="r in typeTotals.rows" :key="r.label" class="mb-2">
                <div class="d-flex justify-space-between">
                  <div><strong>{{ r.label }}</strong> <small class="text-medium-emphasis">· {{ r.count }}</small></div>
                  <small>{{ r.pct }}%</small>
                </div>
                <v-progress-linear :model-value="r.pct" height="8" rounded />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Top items + Recent orders -->
      <v-row class="mt-2" dense>
        <v-col cols="12" md="6">
          <v-card class="rounded-xl">
            <v-card-title>Top Foods (last {{ days }} days)</v-card-title>
            <v-table density="compact" class="rounded-b-xl">
              <thead>
                <tr><th>Name</th><th class="text-right">Qty</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in data?.topFoods || []" :key="f.id">
                  <td>{{ f.name }}</td>
                  <td class="text-right">{{ f.qty }}</td>
                </tr>
                <tr v-if="(data?.topFoods || []).length === 0"><td colspan="2" class="text-medium-emphasis">No data.</td></tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card class="rounded-xl">
            <v-card-title>Top Packages (last {{ days }} days)</v-card-title>
            <v-table density="compact" class="rounded-b-xl">
              <thead>
                <tr><th>Name</th><th class="text-right">Qty</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in data?.topPackages || []" :key="p.id">
                  <td>{{ p.name }}</td>
                  <td class="text-right">{{ p.qty }}</td>
                </tr>
                <tr v-if="(data?.topPackages || []).length === 0"><td colspan="2" class="text-medium-emphasis">No data.</td></tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>

      <v-card class="rounded-xl mt-2">
        <v-card-title>Recent Orders</v-card-title>
        <v-table density="compact" class="rounded-b-xl">
          <thead>
            <tr>
              <th style="width:120px">Time</th><th>#</th><th>Type</th><th>Status</th><th>Customer/Group</th><th>Items</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in data?.recentOrders || []" :key="r._id">
              <td>{{ dayjs(r.createdAt).format('YYYY-MM-DD HH:mm') }}</td>
              <td class="font-mono">…{{ r._id.slice(-6) }}</td>
              <td>{{ r.type }}</td>
              <td><v-chip :color="statusColor(r.status)" label size="small">{{ r.status }}</v-chip></td>
              <td>{{ r.groupKey || r.customerName || '—' }}</td>
              <td>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip v-for="it in r.items" :key="it.name + it.qty" size="x-small" variant="outlined">
                    {{ it.qty }}× {{ it.name }}
                  </v-chip>
                </div>
              </td>
            </tr>
            <tr v-if="(data?.recentOrders || []).length === 0"><td colspan="6" class="text-medium-emphasis">No recent orders.</td></tr>
          </tbody>
        </v-table>
      </v-card>
    </div>
  </v-card>
</template>

<style scoped>
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
</style>
