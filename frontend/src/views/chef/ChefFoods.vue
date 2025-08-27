<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const categories = ref([])

const q = ref('')
const catFilter = ref('ALL')

const headers = [
  { title: 'Image', key: 'image' },
  { title: 'Name', key: 'name' },
  { title: 'Category', key: 'category' },
  { title: 'Availability', key: 'avail', align: 'center' },
  { title: 'Daily Stock', key: 'stock', align: 'center' },
  { title: 'Updated', key: 'updatedAt' },
]

async function loadCats () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = data
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value) params.set('q', q.value)
    if (catFilter.value !== 'ALL') params.set('categoryId', catFilter.value)
    params.set('activeOnly', 'false') // chefs see all
    const { data } = await api.get(`/foods?${params.toString()}`)
    rows.value = data
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => rows.value)

async function toggle (r, scope, value) {
  const { data } = await api.patch(`/foods/${r._id}/toggle`, { scope, value })
  patchRow(data)
}
async function setStock (r) {
  const v = prompt('Set daily limit (empty = unlimited):', r.dailyLimit ?? '')
  if (v === null) return
  const dailyLimit = v === '' ? null : Number(v)
  const { data } = await api.patch(`/foods/${r._id}/stock`, { dailyLimit })
  patchRow(data)
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
      <v-toolbar-title>Foods</v-toolbar-title>
      <template #append>
        <v-btn color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="5">
          <v-text-field v-model="q" label="Search foods" prepend-inner-icon="mdi-magnify" clearable @keyup.enter="load" />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :items="[{title:'All Categories', value:'ALL'}, ...categories.map(c=>({title:c.name, value:c._id}))]"
            v-model="catFilter"
            label="Category"
            @update:modelValue="load"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" @click="load" block>
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="filtered" :items-per-page="10" class="rounded-xl">
        <template #item.image="{ item }">
          <v-avatar size="36" rounded="lg">
            <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Food'" cover />
          </v-avatar>
        </template>

        <template #item.category="{ item }">
          {{ item.categoryId?.name || '—' }}
        </template>

        <template #item.avail="{ item }">
          <div class="d-flex ga-2 justify-center">
            <v-switch
              inset color="primary" hide-details
              :model-value="item.isActiveGlobal"
              @update:modelValue="val => toggleOne(item, 'GLOBAL', val)"
            />

            <v-switch
              inset color="deep-purple" hide-details
              :model-value="item.isActiveKitchen"
              @update:modelValue="val => toggleOne(item, 'KITCHEN', val)"
            />
          </div>
        </template>

        <template #item.stock="{ item }">
          <div class="d-flex flex-column align-center">
            <div v-if="item.dailyLimit === null">Unlimited</div>
            <div v-else>
              <strong>{{ item.stockRemaining ?? item.dailyLimit }}</strong> / {{ item.dailyLimit }}
              <div class="text-caption text-medium-emphasis">({{ item.stockDate || '—' }})</div>
            </div>
            <v-btn size="x-small" variant="text" @click="setStock(item)">
              <v-icon start>mdi-database-edit</v-icon> Set
            </v-btn>
          </div>
        </template>

        <template #item.updatedAt="{ item }">
          <span>{{ new Date(item.updatedAt).toLocaleString() }}</span>
        </template>
      </v-data-table>
    </div>
  </v-card>
</template>

<style scoped>
.v-switch .v-label { font-size: 12px }
</style>
