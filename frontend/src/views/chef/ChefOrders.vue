<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '@/utils/api'
import socket from '@/utils/socket'

const loading = ref(false)
const rows = ref([])
const q = ref('')
// ACTIVE | ALL | PLACED | ACCEPTED | COOKING | READY | DELIVERED | CANCELED
const status = ref('ALL')
const statuses = ['ACTIVE','ALL','PLACED','ACCEPTED','COOKING','READY','DELIVERED','CANCELED']

// 💡 Removed the "Total" column since everything is free.
const headers = [
  { title: 'Time',               key: 'createdAt' },
  { title: 'Type',               key: 'type' },
  { title: 'Customer / Group',   key: 'who' },
  { title: 'Items',              key: 'items' },
  { title: 'Status',             key: 'status', align: 'center' },
  { title: 'Actions',            key: 'actions', align: 'end' }
]

function statusColor (s) {
  return { PLACED:'grey', ACCEPTED:'primary', COOKING:'deep-purple', READY:'orange', DELIVERED:'green', CANCELED:'red' }[s] || 'grey'
}
function prettyWhen (d) { return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
function who (r) { return r.groupKey || r.customerName || '—' }

const filtered = computed(() => {
  let list = rows.value
  if (status.value === 'ACTIVE') {
    list = list.filter(r => ['PLACED','ACCEPTED','COOKING','READY'].includes(r.status))
  } else if (status.value !== 'ALL') {
    list = list.filter(r => r.status === status.value)
  }
  if (q.value.trim()) {
    const qq = q.value.toLowerCase()
    list = list.filter(r =>
      (r.customerName || '').toLowerCase().includes(qq) ||
      (r.groupKey || '').toLowerCase().includes(qq) ||
      r.items.some(i => (i.name || '').toLowerCase().includes(qq))
    )
  }
  return list
})

async function load () {
  loading.value = true
  try {
    const { data } = await api.get('/orders')
    rows.value = data
  } finally {
    loading.value = false
  }
}

function canNext (r) { return ['PLACED','ACCEPTED','COOKING','READY'].includes(r.status) }
function nextStatus (r) { return ({ PLACED:'ACCEPTED', ACCEPTED:'COOKING', COOKING:'READY', READY:'DELIVERED' })[r.status] }

async function advance (r) {
  const next = nextStatus(r)
  if (!next) return

  let url = ''
  if (next === 'ACCEPTED')       url = `/orders/${r._id}/accept`
  else if (next === 'COOKING')   url = `/orders/${r._id}/start`
  else if (next === 'READY')     url = `/orders/${r._id}/ready`
  else if (next === 'DELIVERED') url = `/orders/${r._id}/deliver`

  try {
    const { data } = await api.patch(url)
    upsert(data)
  } catch (e) {
    console.error(e)
    alert(e?.response?.data?.message || 'Failed to advance order')
  }
}

async function cancel (r) {
  try {
    const { data } = await api.patch(`/orders/${r._id}/cancel`)
    upsert(data)
  } catch (e) {
    console.error(e)
    alert(e?.response?.data?.message || 'Failed to cancel order')
  }
}

function upsert (o) {
  const i = rows.value.findIndex(x => x._id === o._id)
  if (i === -1) rows.value.unshift(o)
  else rows.value[i] = o
}

/* ── sockets ── */
const onNew = (order) => upsert(order)
const onStatus = (order) => upsert(order)
const onCompleted = (order) => upsert(order)

onMounted(() => {
  load()
  socket.emit('join', { role: 'CHEF' })
  socket.on('order:new', onNew)
  socket.on('order:status', onStatus)
  socket.on('order:completed', onCompleted)
})

onBeforeUnmount(() => {
  socket.off('order:new', onNew)
  socket.off('order:status', onStatus)
  socket.off('order:completed', onCompleted)
})
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Kitchen Orders</v-toolbar-title>
      <template #append>
        <v-btn color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="5">
          <v-text-field
            v-model="q"
            label="Search (customer, group, item)"
            prepend-inner-icon="mdi-magnify"
            clearable
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-select :items="statuses" v-model="status" label="Status" />
        </v-col>
        <v-col cols="12" md="2">
          <v-btn :loading="loading" block @click="load">
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="filtered" :items-per-page="10" class="rounded-xl">
        <template #item.createdAt="{ item }">
          <span>{{ prettyWhen(item.createdAt) }}</span>
        </template>

        <template #item.type="{ item }">
          <v-chip size="small" color="primary" variant="tonal">{{ item.type }}</v-chip>
        </template>

        <template #item.who="{ item }">
          <div class="d-flex flex-column">
            <strong>{{ who(item) }}</strong>
            <small class="text-medium-emphasis">#{{ item._id.slice(-6) }}</small>
          </div>
        </template>

        <template #item.items="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <!-- 🧹 Removed any unitPrice keys; use stable key from ids/kind/name -->
            <v-chip
              v-for="it in item.items"
              :key="`${it.kind}:${it.foodId || it.packageId}:${it.name || 'Item'}`"
              size="small"
              :prepend-icon="it.kind === 'PACKAGE' ? 'mdi-briefcase-variant' : 'mdi-silverware'"
              variant="outlined"
            >
              {{ it.qty }}× {{ it.name || 'Item' }}
            </v-chip>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" label>{{ item.status }}</v-chip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn
              v-if="canNext(item)"
              color="primary"
              size="small"
              @click="advance(item)"
            >
              <v-icon start>mdi-arrow-right</v-icon> Next
            </v-btn>

            <v-btn
              v-if="['PLACED','ACCEPTED','COOKING','READY'].includes(item.status)"
              color="red"
              variant="text"
              size="small"
              @click="cancel(item)"
            >
              Cancel
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>
  </v-card>
</template>
