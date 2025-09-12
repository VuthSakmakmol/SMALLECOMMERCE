<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])

function prettyDate(d) {
  try { return new Date(d).toLocaleDateString() } catch { return '' }
}
function prettyTime(d) {
  try { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }) } catch { return '' }
}

const grouped = computed(() => {
  const map = new Map()
  for (const o of rows.value) {
    // only show orders with a scheduled date/time
    if (!o.scheduledFor) continue
    const key = new Date(o.scheduledFor).toDateString()
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(o)
  }
  // sort by date asc
  return [...map.entries()]
    .map(([k, list]) => ({ dateKey: k, list: list.sort((a,b) => new Date(a.scheduledFor) - new Date(b.scheduledFor)) }))
    .sort((a,b) => new Date(a.dateKey) - new Date(b.dateKey))
})

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/orders', { params: { scope: 'CUSTOMER' } })
    rows.value = Array.isArray(data) ? data : []
  } finally { loading.value = false }
}

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl elevation-1">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title class="font-weight-bold">Your Calendar</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <div v-if="!grouped.length" class="text-medium-emphasis">No scheduled orders.</div>

      <div v-for="day in grouped" :key="day.dateKey" class="mb-6">
        <div class="text-subtitle-1 font-weight-medium mb-2">{{ prettyDate(day.dateKey) }}</div>
        <v-table density="comfortable" class="rounded-lg">
          <thead>
            <tr>
              <th style="width:140px">Time</th>
              <th>Items</th>
              <th style="width:220px">Receive At</th>
              <th style="width:120px">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in day.list" :key="o._id">
              <td>{{ prettyTime(o.scheduledFor) }}</td>
              <td>
                <div class="d-flex flex-wrap ga-1">
                  <v-chip
                    v-for="it in (o.items||[])"
                    :key="(it.foodId||it.packageId)+'-'+it.qty"
                    size="small" color="primary" variant="tonal"
                  >
                    {{ it.qty }}× {{ it.name || 'Item' }}
                  </v-chip>
                </div>
              </td>
              <td>{{ o.receivePlace || '—' }}</td>
              <td>{{ o.status }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </div>
  </v-card>
</template>
