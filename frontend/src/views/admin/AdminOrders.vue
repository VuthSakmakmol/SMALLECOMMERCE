<!-- src/views/admin/AdminOrder.vue -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import dayjs from 'dayjs'
import api from '@/utils/api'
import socket from '@/utils/socket'

/* ───────── helpers: normalize order shape ───────── */
function normalizeOrder(o = {}) {
  const cust = o.customerId
  const customerId = cust && typeof cust === 'object' ? String(cust._id || cust.id || '') : String(cust || '')
  const customerName = o.customerName ?? (cust && typeof cust === 'object' ? cust.name || null : null)
  return { ...o, customerId, customerName }
}

/* ───────────────── state ───────────────── */
const loading = ref(false)
const rows = ref([])

const q = ref('')
const type = ref('ALL')
const status = ref('ALL')
const types = ['ALL','INDIVIDUAL','GROUP','WORKSHOP']
const statuses = ['ACTIVE','ALL','PLACED','ACCEPTED','COOKING','READY','DELIVERED','CANCELED']

// dialog
const detailOpen = ref(false)
const selected = ref(null)

// caches
const pkgCache = ref(new Map())
const foodCache = ref(new Map())

/* ───────────────── table ───────────────── */
const headers = [
  { title: 'Time', key: 'createdAt', sortable: true },
  { title: 'Type', key: 'type' },
  { title: 'Customer / Group', key: 'who' },
  { title: 'Items', key: 'items' },
  { title: 'Pre-Order', key: 'preorder' },             // <-- NEW column
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'end' }
]

function statusColor (s) {
  return { PLACED:'grey', ACCEPTED:'primary', COOKING:'deep-purple', READY:'orange', DELIVERED:'green', CANCELED:'red' }[s] || 'grey'
}
function prettyWhen (d) {
  const t = dayjs(d)
  return t.isValid() ? `${t.format('HH:mm')} · ${t.format('MMM D')}` : '—'
}
function who (r) { return r.groupKey || r.customerName || '—' }

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
      (r.receivePlace || '').toLowerCase().includes(qq) ||            // allow search by place
      r.items.some(i => (i.name || '').toLowerCase().includes(qq))
    )
  }
  return list
})

/* ───────────────── fetch ───────────────── */
async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (type.value !== 'ALL') params.set('type', type.value)
    if (status.value === 'ACTIVE') params.set('status', 'ACTIVE')
    const { data } = await api.get(`/orders?${params.toString()}`)
    rows.value = (Array.isArray(data) ? data : []).map(normalizeOrder)
  } finally {
    loading.value = false
  }
}

/* ───────────────── actions ───────────────── */
function canNext (r) { return ['PLACED','ACCEPTED','COOKING','READY'].includes(r.status) }
function nextPath (r) {
  switch (r.status) {
    case 'PLACED':   return `/orders/${r._id}/accept`
    case 'ACCEPTED': return `/orders/${r._id}/start`
    case 'COOKING':  return `/orders/${r._id}/ready`
    case 'READY':    return `/orders/${r._id}/deliver`
    default:         return null
  }
}
async function advance (r) {
  const p = nextPath(r)
  if (!p) return
  const { data } = await api.patch(p)
  upsert(normalizeOrder(data))
}
async function cancel (r) {
  const { data } = await api.patch(`/orders/${r._id}/cancel`)
  upsert(normalizeOrder(data))
}
function upsert (o) {
  const i = rows.value.findIndex(x => x._id === o._id)
  if (i === -1) rows.value.unshift(o)
  else rows.value[i] = o
}

/* ─────────────── helpers ─────────────── */
function modsCount (it) {
  if (!it || it.kind !== 'FOOD') return 0
  if (Array.isArray(it.mods) && it.mods.length) return it.mods.length
  const a = Array.isArray(it.ingredients) ? it.ingredients.filter(x => x.included || x.value != null).length : 0
  const b = Array.isArray(it.groups) ? it.groups.filter(g => g.choice != null).length : 0
  return a + b
}

/* ─────────────── detail helpers ─────────────── */
async function fetchPackage(id) {
  const key = String(id)
  if (pkgCache.value.has(key)) return pkgCache.value.get(key)
  const { data } = await api.get(`/packages/${key}`)
  pkgCache.value.set(key, data || {})
  return data
}
async function fetchFood(id) {
  const key = String(id)
  if (foodCache.value.has(key)) return foodCache.value.get(key)
  const { data } = await api.get(`/foods/${key}`)
  foodCache.value.set(key, data || {})
  return data
}
async function preloadForOrder(order) {
  // For any package: load its lines & food names/images
  const pkgIds = new Set()
  const foodIds = new Set()
  for (const it of order.items || []) {
    if (it.kind === 'PACKAGE' && it.packageId) pkgIds.add(String(it.packageId))
  }
  await Promise.all([...pkgIds].map(fetchPackage))
  for (const pid of pkgIds) {
    const pkg = pkgCache.value.get(pid)
    for (const line of (pkg?.items || [])) foodIds.add(String(line.foodId))
  }
  await Promise.all([...foodIds].map(fetchFood))
}

async function openDetail(order) {
  selected.value = order
  detailOpen.value = true
  try { await preloadForOrder(order) } catch (e) {}
}

/* ───────────────── sockets ───────────────── */
onMounted(() => {
  load()
  socket.emit('join', { role: 'ADMIN' })
  const onNew = (order)   => upsert(normalizeOrder(order))
  const onStatus = (order)=> upsert(normalizeOrder(order))
  socket.on('order:new', onNew)
  socket.on('order:status', onStatus)

  onBeforeUnmount(() => {
    socket.off('order:new', onNew)
    socket.off('order:status', onStatus)
  })
})
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar density="comfortable" color="white" class="rounded-t-2xl">
      <template #append>
        <v-btn variant="flat" color="orange" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <v-text-field
            v-model="q"
            label="Search (customer, group, place, item)"
            prepend-inner-icon="mdi-magnify"
            clearable
            variant="outlined"
            density="compact"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-select :items="types" v-model="type" label="Type" variant="outlined" density="compact"/>
        </v-col>
        <v-col cols="12" md="2">
          <v-select :items="statuses" v-model="status" label="Status" variant="outlined" density="compact"/>
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="filtered" :items-per-page="10" class="rounded-xl">
        <template #item.createdAt="{ item }">
          <span>{{ prettyWhen(item.createdAt) }}</span>
        </template>

        <template #item.who="{ item }">
          <div class="d-flex flex-column">
            <strong>{{ who(item) }}</strong>
            <small class="text-medium-emphasis">#{{ item._id.slice(-6) }}</small>
          </div>
        </template>

        <!-- Items with images + mods count -->
        <template #item.items="{ item }">
          <div class="d-flex flex-wrap ga-2">
            <v-chip
              v-for="it in item.items"
              :key="`${it.kind}:${it.foodId || it.packageId}:${it.name || ''}`"
              class="pa-1"
              variant="outlined"
              @click="openDetail(item)"
            >
              <v-avatar start size="32">
                <v-img :src="it.imageUrl || 'https://via.placeholder.com/60?text=Img'" />
              </v-avatar>
              {{ it.qty }}× {{ it.name || 'Item' }}

              <v-btn
                v-if="modsCount(it) > 0"
                size="x-small"
                color="red"
                variant="flat"
                class="ml-2"
                rounded="lg"
                density="comfortable"
                @click.stop="openDetail(item)"
                title="View customizations"
              >
                {{ modsCount(it) }}
              </v-btn>
            </v-chip>
          </div>
        </template>

        <!-- NEW: Pre-Order column -->
        <template #item.preorder="{ item }">
          <div v-if="item.scheduledFor || item.receivePlace">
            <v-chip size="x-small" color="purple" variant="tonal" class="mr-1" v-if="item.scheduledFor">
              {{ prettyWhen(item.scheduledFor) }}
            </v-chip>
            <v-chip size="x-small" color="indigo" variant="tonal" v-if="item.receivePlace">
              {{ item.receivePlace }}
            </v-chip>
          </div>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" label>{{ item.status }}</v-chip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn v-if="canNext(item)" color="primary" size="small" @click="advance(item)">
              <v-icon start>mdi-arrow-right</v-icon> Next
            </v-btn>
            <v-btn
              v-if="['PLACED','ACCEPTED','COOKING','READY'].includes(item.status)"
              color="red" variant="text" size="small" @click="cancel(item)"
            >
              Cancel
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>
  </v-card>

  <!-- Details dialog -->
  <v-dialog v-model="detailOpen" max-width="820">
    <v-card>
      <v-card-title class="d-flex align-center">
        <div class="mr-2">Order #{{ selected?._id?.slice(-6) }} • {{ selected?.type }}</div>
        <v-chip size="small" :color="statusColor(selected?.status || '')" label>{{ selected?.status }}</v-chip>
        <v-spacer />
        <span class="text-caption text-medium-emphasis">ID: {{ selected?._id }}</span>
      </v-card-title>

      <v-card-text>
        <!-- Meta blocks -->
        <v-row dense class="mb-3">
          <v-col cols="12" md="6">
            <v-sheet class="pa-3 rounded-lg elevation-0 bg-grey-lighten-4">
              <div class="text-subtitle-2 mb-1">Placed</div>
              <div>{{ selected?.createdAt ? prettyWhen(selected.createdAt) : '—' }}</div>
              <div class="text-caption text-medium-emphasis">Updated {{ selected?.updatedAt ? prettyWhen(selected.updatedAt) : '—' }}</div>
            </v-sheet>
          </v-col>
          <v-col cols="12" md="6">
            <v-sheet class="pa-3 rounded-lg elevation-0 bg-grey-lighten-4">
              <div class="text-subtitle-2 mb-1">Pre-Order</div>
              <div><strong>Time:</strong> {{ selected?.scheduledFor ? prettyWhen(selected.scheduledFor) : '—' }}</div>
              <div><strong>Place:</strong> {{ selected?.receivePlace || '—' }}</div>
            </v-sheet>
          </v-col>
        </v-row>

        <div class="mb-2"><strong>Customer / Group:</strong> {{ who(selected || {}) }}</div>
        <div class="mb-4"><strong>Notes:</strong> {{ selected?.notes || '—' }}</div>

        <v-divider class="my-3" />

        <h4 class="text-subtitle-1 mb-2">Items</h4>
        <v-list density="comfortable">
          <template v-for="it in selected?.items || []" :key="`${it.kind}:${it.foodId || it.packageId}:${it.name}`">
            <v-list-item>
              <template #prepend>
                <v-avatar size="84" rounded="lg">
                  <v-img :src="it.imageUrl || 'https://via.placeholder.com/84x64?text=Img'" cover />
                </v-avatar>
              </template>
              <v-list-item-title>{{ it.qty }}× {{ it.name }}</v-list-item-title>
              <v-list-item-subtitle>{{ it.kind }}</v-list-item-subtitle>
            </v-list-item>

            <!-- Customizations -->
            <div v-if="modsCount(it) > 0" class="pl-12 mt-1 mb-3">
              <div class="text-caption text-medium-emphasis mb-1">Customizations:</div>
              <ul class="text-caption" style="margin:0;padding-left:16px;">
                <li v-for="(m, idx) in (Array.isArray(it.mods) ? it.mods : [])" :key="idx">
                  <template v-if="String(m.kind).toUpperCase() === 'INGREDIENT'">
                    <strong>{{ m.label || 'Ingredient' }}</strong>:
                    <template v-if="String(m.type).toUpperCase() === 'BOOLEAN'">
                      <span :class="m.value ? 'text-blue' : 'text-red'">
                        {{ m.value ? 'Included' : 'Removed' }}
                      </span>
                    </template>
                    <template v-else-if="String(m.type).toUpperCase() === 'PERCENT'">
                      {{ Number(m.value) }}%
                    </template>
                    <template v-else>
                      {{ m.value }}
                    </template>
                  </template>
                  <template v-else-if="String(m.kind).toUpperCase() === 'GROUP'">
                    <strong>{{ m.label || 'Choice' }}</strong>: {{ m.value }}
                  </template>
                </li>

                <!-- fallback to snapshots if mods empty -->
                <li v-if="(!it.mods || it.mods.length===0) && Array.isArray(it.ingredients)"
                    v-for="(ing, ii) in it.ingredients" :key="'ing-'+ii">
                  <strong>{{ ing.name || 'Ingredient' }}</strong>:
                  <template v-if="ing.value != null">{{ ing.value }}</template>
                  <template v-else>{{ ing.included ? 'Included' : 'Removed' }}</template>
                </li>
                <li v-if="(!it.mods || it.mods.length===0) && Array.isArray(it.groups)"
                    v-for="(g, gi) in it.groups" :key="'grp-'+gi">
                  <strong>{{ g.choiceLabel || 'Choice' }}</strong>: {{ g.choice }}
                </li>
              </ul>
            </div>

            <!-- If package, show its foods (names + images) -->
            <v-expand-transition>
              <div v-if="it.kind==='PACKAGE' && pkgCache.get(String(it.packageId))" class="pl-12 pb-3">
                <div class="text-caption text-medium-emphasis mb-1">Includes:</div>
                <div class="d-flex flex-wrap ga-2">
                  <template v-for="line in pkgCache.get(String(it.packageId)).items" :key="String(line.foodId)">
                    <v-chip size="small" variant="tonal" class="pa-1">
                      <v-avatar start size="28">
                        <v-img :src="(foodCache.get(String(line.foodId))?.imageUrl) || 'https://via.placeholder.com/60?text=Img'" />
                      </v-avatar>
                      ×{{ line.qty }} {{ foodCache.get(String(line.foodId))?.name || '...' }}
                    </v-chip>
                  </template>
                </div>
              </div>
            </v-expand-transition>
          </template>
        </v-list>

        <!-- Timeline -->
        <div class="mt-4">
          <div class="text-subtitle-2 mb-2">Timeline</div>
          <v-row dense>
            <v-col cols="12" sm="6" md="4">
              <div><strong>Accepted:</strong> {{ selected?.acceptedAt ? prettyWhen(selected.acceptedAt) : '—' }}</div>
              <div><strong>Cooking:</strong> {{ selected?.cookingAt ? prettyWhen(selected.cookingAt) : '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div><strong>Ready:</strong> {{ selected?.readyAt ? prettyWhen(selected.readyAt) : '—' }}</div>
              <div><strong>Delivered:</strong> {{ selected?.deliveredAt ? prettyWhen(selected.deliveredAt) : '—' }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div><strong>Canceled:</strong> {{ selected?.canceledAt ? prettyWhen(selected.canceledAt) : '—' }}</div>
              <div class="text-caption text-medium-emphasis mt-1">
                Stock committed: {{ selected?.stockCommitted ? 'Yes' : 'No' }}
              </div>
            </v-col>
          </v-row>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="detailOpen=false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.v-list-item + .v-list-item { border-top: 1px dashed rgba(0,0,0,.06); }
</style>
