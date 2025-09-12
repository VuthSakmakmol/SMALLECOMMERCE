<!-- src/views/chef/ChefAvailability.vue -->
<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const hydrating = ref(true) // for initial skeletons
const rows = ref([])
const categories = ref([])

const q = ref('')
const debouncedQ = ref('')
const cat = ref('ALL')
const selected = ref([]) // v-data-table selection (row objects)

const headers = [
  { title: 'Food', key: 'food', sortable: false }, // (image + name stacked)
  { title: 'Category', key: 'category', width: 180 },
  { title: 'Global', key: 'global', align: 'center', width: 120 },
  { title: 'Kitchen', key: 'kitchen', align: 'center', width: 120 },
  { title: 'Stock (today)', key: 'stock', align: 'center', width: 220 },
]

// ───────── utils ─────────
const catItems = computed(() => [
  { title: 'All Categories', value: 'ALL' },
  ...categories.value.map(c => ({ title: c.name, value: c._id }))
])

function lowStockColor (item) {
  if (item.dailyLimit == null) return 'primary'
  const rem = Number(item.stockRemaining ?? item.dailyLimit)
  const total = Number(item.dailyLimit || 0)
  if (total <= 0) return 'grey'
  const ratio = rem / total
  if (ratio <= 0.15) return 'red'
  if (ratio <= 0.35) return 'orange'
  return 'green'
}
function stockPercent (item) {
  if (item.dailyLimit == null) return 100
  const rem = Number(item.stockRemaining ?? item.dailyLimit)
  const total = Number(item.dailyLimit || 0)
  if (total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((rem / total) * 100)))
}

// ───────── data fetch ─────────
async function loadCats () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = Array.isArray(data) ? data : (data?.data || [])
}
async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('activeOnly', 'false') // show everything to chef
    if (debouncedQ.value) params.set('q', debouncedQ.value)
    if (cat.value !== 'ALL') params.set('categoryId', cat.value)
    const { data } = await api.get(`/foods?${params.toString()}`)
    rows.value = Array.isArray(data) ? data : (data?.data || [])
  } finally {
    loading.value = false
    hydrating.value = false
  }
}

onMounted(async () => {
  hydrating.value = true
  await Promise.all([loadCats(), load()])
})

// debounce q -> debouncedQ
let t = null
watch(q, (v) => {
  clearTimeout(t)
  t = setTimeout(() => {
    debouncedQ.value = (v || '').trim()
    load()
  }, 300)
})

// ───────── table helpers ─────────
const filtered = computed(() => rows.value)

function patchRow (row) {
  const i = rows.value.findIndex(r => r._id === row._id)
  if (i !== -1) rows.value[i] = row
}

async function toggleOne (row, scope, value) {
  const { data } = await api.patch(`/foods/${row._id}/toggle`, { scope, value })
  patchRow(data)
}

async function bulkToggle (scope, value) {
  if (selected.value.length === 0) return
  const sure = confirm(`Turn ${scope.toLowerCase()} ${value ? 'ON' : 'OFF'} for ${selected.value.length} item(s)?`)
  if (!sure) return
  const ops = selected.value.map(r =>
    api.patch(`/foods/${r._id}/toggle`, { scope, value }).then(res => res.data)
  )
  const updated = await Promise.allSettled(ops)
  updated.forEach(r => { if (r.status === 'fulfilled') patchRow(r.value) })
  selected.value = []
}

async function setStock (row) {
  const val = prompt('Daily limit (empty = unlimited):', row.dailyLimit ?? '')
  if (val === null) return
  const dailyLimit = val === '' ? null : Number(val)
  const { data } = await api.patch(`/foods/${row._id}/stock`, { dailyLimit })
  patchRow(data)
}
async function bulkStock () {
  if (selected.value.length === 0) return
  const val = prompt('Set daily limit for selected (empty = unlimited):', '')
  if (val === null) return
  const dailyLimit = val === '' ? null : Number(val)
  const sure = confirm(`Apply ${dailyLimit === null ? 'Unlimited' : dailyLimit} to ${selected.value.length} item(s)?`)
  if (!sure) return
  const ops = selected.value.map(r =>
    api.patch(`/foods/${r._id}/stock`, { dailyLimit }).then(res => res.data)
  )
  const updated = await Promise.allSettled(ops)
  updated.forEach(r => { if (r.status === 'fulfilled') patchRow(r.value) })
  selected.value = []
}

function resetFilters () {
  q.value = ''
  cat.value = 'ALL'
  load()
}
</script>

<template>
  <v-card class="rounded-2xl">
    <!-- Toolbar -->
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Availability</v-toolbar-title>
      <template #append>
        <v-btn color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <!-- Filters -->
      <v-row dense class="mb-3">
        <v-col cols="12" md="5">
          <v-text-field
            v-model="q"
            label="Search foods"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            density="compact"
            clearable
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :items="catItems"
            v-model="cat"
            label="Category"
            variant="outlined"
            density="compact"
            @update:modelValue="load"
          />
        </v-col>
        <v-col cols="12" md="3" class="d-flex ga-2">
          <v-btn :loading="loading" block @click="load">
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
          <v-btn variant="tonal" color="grey" block @click="resetFilters">
            <v-icon start>mdi-backspace</v-icon> Reset
          </v-btn>
        </v-col>
      </v-row>

      <!-- Quick category chips (optional enhancer) -->
      <div class="mb-3 d-flex flex-wrap ga-2">
        <v-chip
          :color="cat==='ALL' ? 'primary' : undefined"
          :variant="cat==='ALL' ? 'flat' : 'tonal'"
          @click="cat='ALL'; load()"
          size="small"
        >All</v-chip>
        <v-chip
          v-for="c in categories"
          :key="c._id"
          :color="cat===c._id ? 'primary' : undefined"
          :variant="cat===c._id ? 'flat' : 'tonal'"
          @click="cat=c._id; load()"
          size="small"
        >{{ c.name }}</v-chip>
      </div>

      <!-- Bulk actions (sticky when items selected) -->
      <v-expand-transition>
        <v-card
          v-if="selected.length > 0"
          elevation="2"
          class="mb-3 pa-3 rounded-xl bulk-bar"
        >
          <div class="d-flex flex-wrap align-center ga-3">
            <div class="text-body-2">
              <strong>{{ selected.length }}</strong> selected
            </div>
            <v-divider vertical class="mx-1" />
            <v-btn size="small" color="deep-purple" variant="flat" @click="bulkToggle('KITCHEN', true)">
              <v-icon start>mdi-door-open</v-icon> Kitchen ON
            </v-btn>
            <v-btn size="small" color="deep-purple" variant="outlined" @click="bulkToggle('KITCHEN', false)">
              <v-icon start>mdi-door-closed</v-icon> Kitchen OFF
            </v-btn>
            <v-divider vertical class="mx-1" />
            <v-btn size="small" color="primary" variant="flat" @click="bulkToggle('GLOBAL', true)">
              <v-icon start>mdi-eye</v-icon> Global ON
            </v-btn>
            <v-btn size="small" color="primary" variant="outlined" @click="bulkToggle('GLOBAL', false)">
              <v-icon start>mdi-eye-off</v-icon> Global OFF
            </v-btn>
            <v-divider vertical class="mx-1" />
            <v-btn size="small" color="orange" variant="tonal" @click="bulkStock">
              <v-icon start>mdi-database-edit</v-icon> Set Daily Stock
            </v-btn>
          </div>
        </v-card>
      </v-expand-transition>

      <!-- Skeleton while hydrating -->
      <v-skeleton-loader
        v-if="hydrating"
        type="table"
        class="rounded-xl mb-2"
      />

      <!-- Table -->
      <v-data-table
        v-else
        :headers="headers"
        :items="filtered"
        item-key="_id"
        show-select
        v-model:selected="selected"
        :items-per-page="10"
        class="rounded-xl"
        hover
      >
        <!-- Food cell (image + name + badges) -->
        <template #item.food="{ item }">
          <div class="d-flex align-center ga-3">
            <v-avatar size="40" rounded="lg">
              <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Food'" cover />
            </v-avatar>
            <div class="d-flex flex-column">
              <div class="text-body-1 font-weight-medium">
                {{ item.name || 'Unnamed Food' }}
              </div>
              <div class="d-flex ga-2">
                <v-chip
                  size="x-small"
                  :color="item.isActiveGlobal ? 'primary' : undefined"
                  :variant="item.isActiveGlobal ? 'flat' : 'outlined'"
                >
                  Global: {{ item.isActiveGlobal ? 'ON' : 'OFF' }}
                </v-chip>
                <v-chip
                  size="x-small"
                  :color="item.isActiveKitchen ? 'deep-purple' : undefined"
                  :variant="item.isActiveKitchen ? 'flat' : 'outlined'"
                >
                  Kitchen: {{ item.isActiveKitchen ? 'ON' : 'OFF' }}
                </v-chip>
              </div>
            </div>
          </div>
        </template>

        <!-- Category -->
        <template #item.category="{ item }">
          {{ item.categoryId?.name || '—' }}
        </template>

        <!-- Global toggle -->
        <template #item.global="{ item }">
          <div class="d-flex justify-center">
            <v-switch
              inset
              color="primary"
              hide-details
              :model-value="item.isActiveGlobal"
              @update:modelValue="val => toggleOne(item, 'GLOBAL', val)"
            />
          </div>
        </template>

        <!-- Kitchen toggle -->
        <template #item.kitchen="{ item }">
          <div class="d-flex justify-center">
            <v-switch
              inset
              color="deep-purple"
              hide-details
              :model-value="item.isActiveKitchen"
              @update:modelValue="val => toggleOne(item, 'KITCHEN', val)"
            />
          </div>
        </template>

        <!-- Stock cell -->
        <template #item.stock="{ item }">
          <div class="d-flex flex-column align-center" style="min-width: 180px;">
            <div v-if="item.dailyLimit === null" class="mb-1">
              <v-chip size="small" variant="tonal" color="primary">Unlimited</v-chip>
            </div>
            <div v-else class="mb-1">
              <strong>{{ item.stockRemaining ?? item.dailyLimit }}</strong> / {{ item.dailyLimit }}
            </div>

            <v-tooltip location="top">
              <template #activator="{ props }">
                <div v-bind="props" style="width: 160px;">
                  <v-progress-linear
                    :model-value="stockPercent(item)"
                    :color="lowStockColor(item)"
                    rounded
                    height="10"
                  />
                </div>
              </template>
              <span>
                {{ stockPercent(item) }}% remaining
                <template v-if="item.stockDate"> • {{ item.stockDate }}</template>
              </span>
            </v-tooltip>

            <v-btn size="x-small" variant="text" class="mt-1" @click="setStock(item)">
              <v-icon start>mdi-database-edit</v-icon> Set
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>
  </v-card>
</template>

<style scoped>
.v-switch .v-label { font-size: 12px }
.bulk-bar {
  position: sticky;
  top: 8px;
  z-index: 2;
  backdrop-filter: saturate(1.2) blur(4px);
}
</style>
