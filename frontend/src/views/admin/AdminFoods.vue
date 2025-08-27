<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const categories = ref([])
const rows = ref([])
const q = ref('')
const catFilter = ref('ALL')

const dialog = ref(false)
const editing = ref(null)
const form = ref({ name: '', categoryId: '', imageUrl: '', description: '', tags: [] })

const headers = [
  { title: 'Image', key: 'image' },
  { title: 'Name', key: 'name' },
  { title: 'Category', key: 'category' },
  { title: 'Availability', key: 'avail', align: 'center' },
  { title: 'Daily Stock', key: 'stock', align: 'center' },
  { title: 'Updated', key: 'updatedAt' },
  { title: 'Actions', key: 'actions', align: 'end' }
]

async function loadCats() {
  const { data } = await api.get('/api/categories?activeOnly=true')
  categories.value = data
}

async function load() {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (catFilter.value !== 'ALL') params.set('categoryId', catFilter.value)
    params.set('q', q.value || '')
    params.set('activeOnly', 'false')
    const { data } = await api.get(`/api/foods?${params.toString()}`)
    rows.value = data
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => rows.value)

function openCreate() {
  editing.value = null
  form.value = { name: '', categoryId: '', imageUrl: '', description: '', tags: [] }
  dialog.value = true
}
function openEdit(r) {
  editing.value = r
  form.value = { name: r.name, categoryId: r.categoryId?._id || r.categoryId, imageUrl: r.imageUrl, description: r.description, tags: r.tags || [] }
  dialog.value = true
}
async function save() {
  if (!form.value.name || !form.value.categoryId) return
  if (editing.value) {
    const { data } = await api.put(`/api/foods/${editing.value._id}`, form.value)
    patchRow(data)
  } else {
    const { data } = await api.post('/api/foods', form.value)
    rows.value.unshift(data)
  }
  dialog.value = false
}

function patchRow(data) {
  const i = rows.value.findIndex(r => r._id === data._id)
  if (i !== -1) rows.value[i] = data
}

async function removeOne(r) {
  if (!confirm(`Delete "${r.name}"?`)) return
  await api.delete(`/api/foods/${r._id}`)
  rows.value = rows.value.filter(x => x._id !== r._id)
}

async function toggle(r, scope, value) {
  const { data } = await api.patch(`/api/foods/${r._id}/toggle`, { scope, value })
  patchRow(data)
}

async function setStock(r) {
  const v = prompt('Set daily limit (empty to unlimited):', r.dailyLimit ?? '')
  if (v === null) return
  const dailyLimit = v === '' ? null : Number(v)
  const { data } = await api.patch(`/api/foods/${r._id}/stock`, { dailyLimit })
  patchRow(data)
}
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Foods</v-toolbar-title>
      <template #append>
        <v-btn color="white" variant="flat" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> New
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
              inset
              color="primary"
              :model-value="item.isActiveGlobal"
              @change="toggle(item, 'GLOBAL', $event)"
              hide-details
              label="Global"
            />
            <v-switch
              inset
              color="deep-purple"
              :model-value="item.isActiveKitchen"
              @change="toggle(item, 'KITCHEN', $event)"
              hide-details
              label="Kitchen"
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

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn size="small" color="primary" variant="tonal" @click="openEdit(item)">
              <v-icon start>mdi-pencil</v-icon> Edit
            </v-btn>
            <v-btn size="small" color="red" variant="text" @click="removeOne(item)">
              <v-icon start>mdi-delete</v-icon> Delete
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>

    <v-dialog v-model="dialog" max-width="640">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Food' : 'New Food' }}</v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field v-model="form.name" label="Name" />
            </v-col>
            <v-col cols="12" md="6">
              <v-select
                :items="categories.map(c=>({title:c.name, value:c._id}))"
                v-model="form.categoryId"
                label="Category"
              />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.imageUrl" label="Image URL" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.description" label="Description" rows="3" />
            </v-col>
            <v-col cols="12">
              <v-combobox v-model="form.tags" multiple chips label="Tags (spicy, vegan, ...)" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-card-actions>
          <v-spacer/>
          <v-btn variant="text" @click="dialog=false">Cancel</v-btn>
          <v-btn color="primary" @click="save">
            <v-icon start>mdi-content-save</v-icon> Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.v-switch .v-label { font-size: 12px }
</style>
