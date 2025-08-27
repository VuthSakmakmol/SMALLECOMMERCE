<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth } from '@/store/auth'
import api from '@/utils/api'
import socket from '@/utils/socket'

const auth = useAuth()
const loading = ref(false)
const rows = ref([])

const headers = [
  { title: 'Time',   key: 'createdAt' },
  { title: 'Type',   key: 'type' },
  { title: 'Items',  key: 'items' },
  { title: 'Total',  key: 'total', align: 'end' },
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'end' }
]

function prettyTime (d) { return new Date(d).toLocaleString() }
function statusColor (s) {
  return { PLACED:'grey', ACCEPTED:'primary', COOKING:'deep-purple', READY:'orange', DELIVERED:'green', CANCELED:'red' }[s] || 'grey'
}

async function load () {
  loading.value = true
  try {
    const { data } = await api.get('/orders?scope=CUSTOMER')
    rows.value = data
    // subscribe to active orders
    data.forEach(o => { if (['PLACED','ACCEPTED','COOKING','READY'].includes(o.status)) socket.emit('join-order', { orderId: o._id }) })
  } finally { loading.value = false }
}

function upsert (o) {
  const i = rows.value.findIndex(x => x._id === o._id)
  if (i === -1) rows.value.unshift(o)
  else rows.value[i] = o
}

async function markReceived (o) {
  try {
    const { data } = await api.patch(`/orders/${o._id}/deliver`)
    upsert(data)
  } catch (e) {
    console.error(e)
    alert(e?.response?.data?.message || 'Failed to mark as received')
  }
}

onMounted(() => {
  load()
  socket.emit('join', { role: 'CUSTOMER', userId: auth.user?._id })
  const onStatus = (order) => upsert(order)
  socket.on('order:status', onStatus)
  onBeforeUnmount(() => socket.off('order:status', onStatus))
})
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>My Orders</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-data-table :headers="headers" :items="rows" :items-per-page="10" class="rounded-xl">
        <template #item.createdAt="{ item }">
          {{ prettyTime(item.createdAt) }}
        </template>
        <template #item.items="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip v-for="it in item.items" :key="(it.foodId||it.packageId)+'-'+it.qty" size="small" variant="outlined">
              {{ it.qty }}× {{ it.name || 'Item' }}
            </v-chip>
          </div>
        </template>
        <template #item.total="{ item }">
          <strong>${{ Number(item.grandTotal || 0).toFixed(2) }}</strong>
        </template>
        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" label>{{ item.status }}</v-chip>
        </template>
        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn
              v-if="item.status === 'READY'"
              color="green" size="small" @click="markReceived(item)">
              <v-icon start>mdi-check</v-icon> Received
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>
  </v-card>
</template>
