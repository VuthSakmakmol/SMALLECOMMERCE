<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'
import socket from '@/utils/socket'

const cols = ref({
  PENDING: [], ACCEPTED: [], COOKING: [], READY: [], DELIVERED: []
})
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    const { data } = await api.get('/orders', { params: { scope: 'CHEF' } })
    const map = { PENDING: [], ACCEPTED: [], COOKING: [], READY: [], DELIVERED: [] }
    data.forEach(o => (map[o.status] || (map[o.status]=[])).push(o))
    cols.value = map
  } finally { loading.value = false }
}

const act = async (id, action) => {
  await api.patch(`/orders/${id}/${action}`) // accept | start | ready
  await load()
}

onMounted(() => {
  load()
  socket.on('orders:new', load)
  socket.on('orders:update', load)
})
</script>

<template>
  <div>
    <h2>Orders</h2>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />
    <v-row dense>
      <v-col cols="12" md="3" v-for="status in ['PENDING','ACCEPTED','COOKING','READY','DELIVERED']" :key="status">
        <v-card>
          <v-card-title>{{ status }} ({{ cols[status].length }})</v-card-title>
          <v-divider />
          <v-card-text style="min-height: 240px">
            <div v-for="o in cols[status]" :key="o._id" class="mb-3 pa-2 rounded border">
              <div class="text-subtitle-2">#{{ o._id.slice(-6) }}</div>
              <div class="text-body-2">{{ o.items.map(i => i.nameSnapshot).join(', ') }}</div>
              <div class="mt-2 d-flex" style="gap:6px">
                <v-btn v-if="status==='PENDING'"  size="x-small" @click="act(o._id,'accept')">Accept</v-btn>
                <v-btn v-if="status==='ACCEPTED'" size="x-small" @click="act(o._id,'start')">Start</v-btn>
                <v-btn v-if="status==='COOKING'" size="x-small" color="success" @click="act(o._id,'ready')">Ready</v-btn>
                <!-- DELIVERED has no actions -->
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<style scoped>
.border { border: 1px solid rgba(0,0,0,0.1); }
</style>
