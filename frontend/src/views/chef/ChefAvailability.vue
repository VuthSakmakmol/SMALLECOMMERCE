<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const categories = ref([])

const q = ref('')
const cat = ref('ALL')
const selected = ref([]) // v-data-table selection

const headers = [
  { title: 'Image', key: 'image' },
  { title: 'Food', key: 'name' },
  { title: 'Category', key: 'category' },
  { title: 'Global', key: 'global', align: 'center' },
  { title: 'Kitchen', key: 'kitchen', align: 'center' },
  { title: 'Stock (today)', key: 'stock', align: 'center' },
]

async function loadCats () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = data
}
async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('activeOnly', 'false') // show everything to chef
    if (q.value) params.set('q', q.value)
    if (cat.value !== 'ALL') params.set('categoryId', cat.value)
    const { data } = await api.get(`/foods?${params.toString()}`)
    rows.value = data
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => rows.value)

async function toggleOne (row, scope, value) {
  const { data } = await api.patch(`/foods/${row._id}/toggle`, { scope, value })
  patchRow(data)
}
async function bulkToggle (scope, value) {
  if (selected.value.length === 0) return
  const sure = confirm(`Turn ${scope.toLowerCase()} ${value ? 'ON' : 'OFF'} for ${selected.value.length} item(s)?`)
  if (!sure) return
  const ops = selected.value.map(r => api.patch(`/foods/${r._id}/toggle`, { scope, value }).then(res => res.data))
  const updated = await Promise.allSettled(ops)
  updated.forEach(r => { if (r.status === 'fulfilled') patchRow(r.value) })
  // refresh selection (objects changed)
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
  const ops = selected.value.map(r => api.patch(`/foods/${r._id}/stock`, { dailyLimit }).then(res => res.data))
  const updated = await Promise.allSettled(ops)
  updated.forEach(r => { if (r.status === 'fulfilled') patchRow(r.value) })
  selected.value = []
}

function patchRow (data) {
  const i = rows.value.findIndex(x => x._id === data._id)
  if (i !== -1) rows.value[i] = data
}
onMounted(async () => {
  await Promise.all([loadCats(), load()])
})
</script>

<template>
  <v-card class="rounded-2xl">
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
            clearable
            @keyup.enter="load"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :items="[{title:'All Categories', value:'ALL'}, ...categories.map(c=>({title:c.name, value:c._id}))]"
            v-model="cat"
            label="Category"
            @update:modelValue="load"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="load">
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <!-- Bulk actions -->
      <v-card variant="tonal" class="mb-3 pa-3 rounded-xl">
        <div class="d-flex flex-wrap ga-2">
          <v-btn size="small" color="deep-purple" variant="flat" @click="bulkToggle('KITCHEN', true)">
            <v-icon start>mdi-door-open</v-icon> Kitchen ON (Selected)
          </v-btn>
          <v-btn size="small" color="deep-purple" variant="outlined" @click="bulkToggle('KITCHEN', false)">
            <v-icon start>mdi-door-closed</v-icon> Kitchen OFF (Selected)
          </v-btn>
          <v-divider vertical class="mx-2" />
          <v-btn size="small" color="primary" variant="flat" @click="bulkToggle('GLOBAL', true)">
            <v-icon start>mdi-eye</v-icon> Global ON (Selected)
          </v-btn>
          <v-btn size="small" color="primary" variant="outlined" @click="bulkToggle('GLOBAL', false)">
            <v-icon start>mdi-eye-off</v-icon> Global OFF (Selected)
          </v-btn>
          <v-divider vertical class="mx-2" />
          <v-btn size="small" color="orange" variant="tonal" @click="bulkStock">
            <v-icon start>mdi-database-edit</v-icon> Set Daily Stock (Selected)
          </v-btn>
        </div>
      </v-card>

      <!-- Table -->
      <v-data-table
        :headers="headers"
        :items="filtered"
        item-key="_id"
        show-select
        v-model:selected="selected"
        :items-per-page="10"
        class="rounded-xl"
      >
        <template #item.image="{ item }">
          <v-avatar size="36" rounded="lg">
            <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Food'" cover />
          </v-avatar>
        </template>

        <template #item.category="{ item }">
          {{ item.categoryId?.name || '—' }}
        </template>

        <template #item.global="{ item }">
          <div class="d-flex justify-center">
            <v-switch inset color="primary" hide-details
                      :model-value="item.isActiveGlobal"
                      @change="toggleOne(item, 'GLOBAL', $event)" />
          </div>
        </template>

        <template #item.kitchen="{ item }">
          <div class="d-flex justify-center">
            <v-switch inset color="deep-purple" hide-details
                      :model-value="item.isActiveKitchen"
                      @change="toggleOne(item, 'KITCHEN', $event)" />
          </div>
        </template>

        <template #item.stock="{ item }">
          <div class="d-flex flex-column align-center">
            <div v-if="item.dailyLimit === null">Unlimited</div>
            <div v-else>
              <strong>{{ item.stockRemaining ?? item.dailyLimit }}</strong> / {{ item.dailyLimit }}
              <div class="text-caption text-medium-emphasis">{{ item.stockDate || '—' }}</div>
            </div>
            <v-btn size="x-small" variant="text" @click="setStock(item)">
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
</style>
