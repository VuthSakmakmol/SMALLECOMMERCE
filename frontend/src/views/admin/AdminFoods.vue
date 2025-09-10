<!-- src/views/admin/AdminFood.vue -->
<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const categories = ref([])
const rows = ref([])

const q = ref('')
const catFilter = ref('ALL')
const inStockOnly = ref(false)

const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)

const form = ref({
  name: '',
  categoryId: '',
  imageUrl: '',
  description: '',
  tags: [],
  stockQty: null, // null = unlimited
})

const snackbar = ref(false)
const snackText = ref('')
const snackColor = ref('success')

const headers = [
  { title: 'Image',        key: 'image',     sortable: false },
  { title: 'Name',         key: 'name' },
  { title: 'Category',     key: 'category' },
  { title: 'Availability', key: 'avail',     align: 'center', sortable: false },
  { title: 'Stock',        key: 'stock',     align: 'center', sortable: false },
  { title: 'Updated',      key: 'updatedAt' },
  { title: 'Actions',      key: 'actions',   align: 'end',     sortable: false },
]

const rules = {
  required: v => !!String(v).trim() || 'Required',
  nonnegIntOrEmpty: v =>
    (v === null || v === '' || (Number.isInteger(Number(v)) && Number(v) >= 0))
    || 'Enter integer ≥ 0 or leave blank',
}

const categoryOptions = computed(() =>
  categories.value.map(c => ({ title: c.name, value: c._id }))
)

function notify(msg, color='success') {
  snackText.value = msg
  snackColor.value = color
  snackbar.value = true
}

/* ---------------- load ---------------- */

async function loadCats () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = Array.isArray(data) ? data : (data?.data || [])
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('activeOnly', 'false') // admins see all
    if (catFilter.value !== 'ALL') params.set('categoryId', catFilter.value)
    if (q.value) params.set('q', q.value)
    if (inStockOnly.value) params.set('inStockOnly', 'true')
    const { data } = await api.get(`/foods?${params.toString()}`)
    rows.value = Array.isArray(data) ? data : (data?.data || [])
  } catch (e) {
    notify(e?.response?.data?.message || 'Failed to load foods', 'error')
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => rows.value)

watch([q, catFilter, inStockOnly], () => {
  // keep manual Refresh; call load() here if you prefer auto-refresh
})

/* ---------------- CRUD ---------------- */

function openCreate () {
  editing.value = null
  form.value = { name: '', categoryId: '', imageUrl: '', description: '', tags: [], stockQty: null }
  dialog.value = true
}

function openEdit (r) {
  editing.value = r
  form.value = {
    name: r.name,
    categoryId: r.categoryId?._id || r.categoryId || '',
    imageUrl: r.imageUrl || '',
    description: r.description || '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    stockQty: r.stockQty ?? null,
  }
  dialog.value = true
}

function patchRow (data) {
  const i = rows.value.findIndex(r => r._id === data._id)
  if (i !== -1) rows.value[i] = data
}

async function save () {
  const ok = await formRef.value?.validate()
  if (!ok?.valid) return

  // coerce stock to number or null
  const raw = form.value.stockQty
  const stockQty = (raw === '' || raw === null || raw === undefined) ? null : Number(raw)
  if (stockQty !== null && (!Number.isInteger(stockQty) || stockQty < 0)) {
    notify('Stock must be an integer ≥ 0 or left blank.', 'error')
    return
  }

  const payload = {
    name: form.value.name.trim(),
    categoryId: form.value.categoryId,
    imageUrl: form.value.imageUrl || '',
    description: form.value.description || '',
    tags: Array.isArray(form.value.tags) ? form.value.tags : [],
    stockQty,
  }

  try {
    if (editing.value) {
      const { data } = await api.put(`/foods/${editing.value._id}`, payload)
      patchRow(data)
      notify('Food updated')
    } else {
      const { data } = await api.post('/foods', payload)
      rows.value.unshift(data)
      notify('Food created')
    }
    dialog.value = false
  } catch (e) {
    notify(e?.response?.data?.message || 'Save failed', 'error')
  }
}

async function removeOne (r) {
  if (!confirm(`Delete "${r.name}"?`)) return
  try {
    await api.delete(`/foods/${r._id}`)
    rows.value = rows.value.filter(x => x._id !== r._id)
    notify('Food deleted')
  } catch (e) {
    notify(e?.response?.data?.message || 'Delete failed', 'error')
  }
}

async function toggle (r, scope, value) {
  try {
    const { data } = await api.patch(`/foods/${r._id}/toggle`, { scope, value })
    patchRow(data)
    notify(`${scope === 'GLOBAL' ? 'Global' : 'Kitchen'} ${value ? 'enabled' : 'disabled'}`)
  } catch (e) {
    notify(e?.response?.data?.message || 'Toggle failed', 'error')
  }
}

async function setStock (r) {
  const current = r.stockQty ?? ''
  const v = prompt('Set stock quantity (leave empty for unlimited):', current)
  if (v === null) return
  const stockQty = v === '' ? null : Number(v)
  if (stockQty !== null && (!Number.isInteger(stockQty) || stockQty < 0)) {
    notify('Enter an integer ≥ 0 or leave blank.', 'error')
    return
  }
  try {
    const { data } = await api.patch(`/foods/${r._id}/stock`, { stockQty })
    patchRow(data)
    notify(stockQty === null ? 'Stock set to unlimited' : `Stock set to ${stockQty}`)
  } catch (e) {
    notify(e?.response?.data?.message || 'Set stock failed', 'error')
  }
}

/* ---------------- init ---------------- */

onMounted(async () => {
  await Promise.all([loadCats(), load()])
})
</script>

<template>
  <v-card class="rounded-2xl">
    <!-- Toolbar -->
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Foods</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn color="white" variant="flat" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> New
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <!-- Filters -->
      <v-row dense class="mb-3">
        <v-col cols="12" md="4">
          <v-text-field
            v-model="q"
            label="Search foods"
            variant="outlined"
            density="compact"
            prepend-inner-icon="mdi-magnify"
            clearable
            @keyup.enter="load"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :items="[{title:'All Categories', value:'ALL'}, ...categoryOptions]"
            v-model="catFilter"
            density="compact"
            variant="outlined"
            label="Category"
            @update:modelValue="load"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-checkbox
            v-model="inStockOnly"
            density="compact"
            label="In stock only"
            hide-details
            @update:modelValue="load"
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-btn :loading="loading" @click="load" block>
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <!-- Table -->
      <v-data-table :headers="headers" :items="filtered" :items-per-page="10" class="rounded-xl" :loading="loading">
        <template #item.image="{ item }">
          <v-avatar size="36" rounded="lg">
            <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Food'" cover />
          </v-avatar>
        </template>

        <template #item.category="{ item }">
          {{ item.categoryId?.name || '—' }}
        </template>

        <template #item.avail="{ item }">
          <div class="d-flex ga-4 justify-center flex-wrap">
            <v-switch
              inset color="primary" hide-details
              :model-value="item.isActiveGlobal"
              @update:modelValue="val => toggle(item, 'GLOBAL', val)"
              label="Global"
            />
            <v-switch
              inset color="deep-purple" hide-details
              :model-value="item.isActiveKitchen"
              @update:modelValue="val => toggle(item, 'KITCHEN', val)"
              label="Kitchen"
            />
          </div>
        </template>

        <template #item.stock="{ item }">
          <div class="d-flex flex-column align-center">
            <div v-if="item.stockQty === null">Unlimited</div>
            <div v-else><strong>{{ item.stockQty }}</strong></div>
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

        <template #no-data>
          <div class="text-medium-emphasis pa-6">No foods found.</div>
        </template>
      </v-data-table>
    </div>

    <!-- Dialog -->
    <v-dialog v-model="dialog" max-width="720">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Food' : 'New Food' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.name" label="Name" :rules="[rules.required]" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select :items="categoryOptions" v-model="form.categoryId" label="Category" :rules="[rules.required]" />
              </v-col>
              <v-col cols="12">
                <v-text-field v-model="form.imageUrl" label="Image URL" />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="form.description" label="Description" rows="3" />
              </v-col>
              <v-col cols="12" md="6">
                <v-combobox v-model="form.tags" multiple chips label="Tags (spicy, vegan, ...)" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.stockQty"
                  type="number"
                  label="Stock (leave blank for unlimited)"
                  :rules="[rules.nonnegIntOrEmpty]"
                  hint="No daily reset; decremented on order; cancel restores."
                  persistent-hint
                />
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog=false">Cancel</v-btn>
          <v-btn color="primary" @click="save">
            <v-icon start>mdi-content-save</v-icon> Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- FAB -->
    <v-fab icon="mdi-plus" app location="bottom end" color="primary" @click="openCreate" />

    <v-snackbar v-model="snackbar" :color="snackColor" timeout="2200">
      {{ snackText }}
    </v-snackbar>
  </v-card>
</template>

<style scoped>
.v-switch .v-label { font-size: 12px }
</style>
