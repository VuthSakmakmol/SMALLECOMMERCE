<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '@/utils/api'
import socket from '@/utils/socket'
import dayjs from 'dayjs'

const loading = ref(false)
const rows = ref([])
const q = ref('')
const type = ref('ALL') // ALL | INDIVIDUAL | GROUP | WORKSHOP
const status = ref('ACTIVE') // ACTIVE (PLACED..READY), COMPLETED, CANCELED, ALL

const types = ['ALL','INDIVIDUAL','GROUP','WORKSHOP']
const statuses = ['ACTIVE','ALL','PLACED','ACCEPTED','COOKING','READY','COMPLETED','CANCELED']

const headers = [
  { title: 'Time', key: 'createdAt', sortable: true },
  { title: 'Type', key: 'type' },
  { title: 'Customer / Group', key: 'who' },
  { title: 'Items', key: 'items' },
  { title: 'Total', key: 'grandTotal', align: 'end' },
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'end' }
]

function statusColor(s) {
  return {
    PLACED: 'grey',
    ACCEPTED: 'primary',
    COOKING: 'deep-purple',
    READY: 'orange',
    COMPLETED: 'green',
    CANCELED: 'red'
  }[s] || 'grey'
}

const filtered = computed(() => {
  let list = rows.value
  if (type.value !== 'ALL') list = list.filter(r => r.type === type.value)
  if (status.value === 'ACTIVE') list = list.filter(r => ['PLACED','ACCEPTED','COOKING','READY'].includes(r.status))
  else if (status.value !== 'ALL') list = list.filter(r => r.status === status.value)
  if (q.value.trim()) {
    const qq = q.value.toLowerCase()
    list = list.filter(r =>
      (r.customerName || '').toLowerCase().includes(qq) ||
      (r.groupKey || '').toLowerCase().includes(qq) ||
      r.items.some(i => i.name.toLowerCase().includes(qq))
    )
  }
  return list
})

async function load() {
  loading.value = true
  try {
    // let backend filter by type if you want
    const params = new URLSearchParams()
    if (type.value !== 'ALL') params.set('type', type.value)
    const { data } = await api.get(`/api/orders?${params.toString()}`)
    rows.value = data
  } finally {
    loading.value = false
  }
}

function prettyWhen(d) {
  return dayjs(d).format('HH:mm')
}

function describeWho(r) {
  if (r.groupKey) return r.groupKey
  if (r.customerName) return r.customerName
  return '—'
}

function canNext(r) {
  return ['PLACED','ACCEPTED','COOKING','READY'].includes(r.status)
}
function nextStatus(r) {
  return {
    PLACED: 'ACCEPTED',
    ACCEPTED: 'COOKING',
    COOKING: 'READY',
    READY: 'COMPLETED'
  }[r.status]
}

async function advance(r) {
  const next = nextStatus(r)
  if (!next) return
  const { data } = await api.patch(`/api/orders/${r._id}/status`, { nextStatus: next })
  upsertOrder(data)
}

async function cancel(r) {
  const { data } = await api.patch(`/api/orders/${r._id}/status`, { nextStatus: 'CANCELED' })
  upsertOrder(data)
}

function upsertOrder(o) {
  const idx = rows.value.findIndex(x => x._id === o._id)
  if (idx === -1) rows.value.unshift(o)
  else rows.value[idx] = o
}

onMounted(() => {
  load()

  // Join “admin” & general chef rooms to hear everything
  socket.emit('join', { role: 'ADMIN' })

  const onNew = (order) => upsertOrder(order)
  const onStatus = (order) => upsertOrder(order)
  const onCompleted = (order) => upsertOrder(order)

  socket.on('order:new', onNew)
  socket.on('order:status', onStatus)
  socket.on('order:completed', onCompleted)

  onBeforeUnmount(() => {
    socket.off('order:new', onNew)
    socket.off('order:status', onStatus)
    socket.off('order:completed', onCompleted)
  })
})
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar density="comfortable" color="primary" class="rounded-t-2xl">
      <v-toolbar-title>Orders</v-toolbar-title>
      <template #append>
        <v-btn variant="flat" color="white" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <v-text-field v-model="q" label="Search (customer, group, item)" prepend-inner-icon="mdi-magnify" clearable />
        </v-col>
        <v-col cols="12" md="3">
          <v-select :items="types" v-model="type" label="Type" />
        </v-col>
        <v-col cols="12" md="3">
          <v-select :items="statuses" v-model="status" label="Status" />
        </v-col>
      </v-row>

      <v-data-table
        :headers="headers"
        :items="filtered"
        :items-per-page="10"
        class="rounded-xl"
      >
        <template #item.createdAt="{ item }">
          <span>{{ prettyWhen(item.createdAt) }}</span>
        </template>

        <template #item.who="{ item }">
          <div class="d-flex flex-column">
            <strong>{{ describeWho(item) }}</strong>
            <small class="text-medium-emphasis">#{{ item._id.slice(-6) }}</small>
          </div>
        </template>

        <template #item.items="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="it in item.items"
              :key="it.name + it.unitPrice"
              size="small"
              :prepend-icon="it.kind === 'PACKAGE' ? 'mdi-briefcase-variant' : 'mdi-silverware'"
              variant="outlined"
            >
              {{ it.qty }}× {{ it.name }}
            </v-chip>
          </div>
        </template>

        <template #item.grandTotal="{ item }">
          <strong>${{ Number(item.grandTotal || 0).toFixed(2) }}</strong>
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
