<!-- src/views/admin/AdminPackage.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const foods = ref([])

const q = ref('')
const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)

const PACKAGE_TYPES = ['Individual','Group','Workshop']

const form = ref({ name:'', imageUrl:'', description:'', items:[] })

const headers = [
  { title: 'Image',   key: 'image',  sortable: false },
  { title: 'Package', key: 'name' },
  { title: 'Items',   key: 'items',  sortable: false },
  { title: 'Active',  key: 'active', align: 'center', sortable: false },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false }
]

const snackbar = ref(false)
const snackText = ref('')
const snackColor = ref('success')
const notify = (msg, color='success') => { snackText.value = msg; snackColor.value = color; snackbar.value = true }

const foodOptions = computed(() =>
  foods.value.map(f => ({ title: f.name, value: f._id }))
)

const rules = {
  required: v => !!String(v).trim() || 'Required',
  hasItems: () => (form.value.items.length > 0) || 'Add at least one item'
}

function resetForm () {
  form.value = { name: '', imageUrl: '', description: '', items: [] }
}

function openCreate () {
  editing.value = null
  resetForm()
  dialog.value = true
}

function openEdit (r) {
  editing.value = r
  form.value = {
    name: r.name,
    imageUrl: r.imageUrl || '',
    description: r.description || '',
    items: (r.items || []).map(i => ({ foodId: i.foodId, qty: i.qty }))
  }
  dialog.value = true
}

function upsertRow (pkg) {
  const i = rows.value.findIndex(r => r._id === pkg._id)
  if (i === -1) rows.value.unshift(pkg)
  else rows.value[i] = pkg
}

async function save () {
  const ok = await formRef.value?.validate()
  if (!ok?.valid || form.value.items.length === 0) return

  // enforce only 3 types + avoid duplicates client-side
  if (!PACKAGE_TYPES.includes(form.value.name)) {
    notify('Package must be one of: Individual, Group, Workshop', 'error')
    return
  }
  const exists = rows.value.find(r => r.name === form.value.name)
  if (!editing.value && exists) {
    notify(`${form.value.name} package already exists`, 'error')
    return
  }

  try {
    if (editing.value) {
      const { data } = await api.put(`/packages/${editing.value._id}`, form.value)
      upsertRow(data)
      notify('Package updated')
    } else {
      const { data } = await api.post('/packages', form.value)
      rows.value.unshift(data)
      notify('Package created')
    }
    dialog.value = false
  } catch (e) {
    notify(e?.response?.data?.message || 'Save failed', 'error')
  }
}

async function toggleActive (r, value) {
  try {
    const { data } = await api.patch(`/packages/${r._id}/toggle`, { value })
    upsertRow(data)
    notify(value ? 'Activated' : 'Deactivated')
  } catch (e) {
    notify(e?.response?.data?.message || 'Toggle failed', 'error')
  }
}

async function removeOne (r) {
  if (!confirm(`Delete package "${r.name}"?`)) return
  try {
    await api.delete(`/packages/${r._id}`)
    rows.value = rows.value.filter(x => x._id !== r._id)
    notify('Package deleted')
  } catch (e) {
    notify(e?.response?.data?.message || 'Delete failed', 'error')
  }
}

async function loadFoods () {
  const { data } = await api.get('/foods?activeOnly=true')
  foods.value = Array.isArray(data) ? data : (data?.data || [])
}
async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value.trim()) params.set('q', q.value.trim())
    const { data } = await api.get(`/packages?${params.toString()}`)
    rows.value = Array.isArray(data) ? data : (data?.data || [])
  } finally {
    loading.value = false
  }
}

function addLine () {
  form.value.items.push({ foodId: null, qty: 1 })
}
function removeLine (idx) {
  form.value.items.splice(idx, 1)
}
function nameOfFood (id) {
  return foods.value.find(f => f._id === id)?.name || '—'
}

onMounted(async () => {
  await Promise.all([loadFoods(), load()])
})
</script>

<template>
  <v-card class="rounded-2xl">
    <!-- Toolbar -->
    <v-toolbar color="white" density="comfortable" class="rounded-t-2xl">
      <template #append>
        <v-btn class="mr-2" color="orange" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn color="orange" variant="flat" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> New
        </v-btn>
      </template>
    </v-toolbar>

    <!-- Filters -->
    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="3">
          <v-text-field
            v-model="q"
            density="compact"
            variant="outlined"
            label="Search package"
            prepend-inner-icon="mdi-magnify"
            clearable
            @keyup.enter="load"
          />
        </v-col>
      </v-row>

      <!-- Table -->
      <v-data-table :headers="headers" :items="rows" :items-per-page="10" class="rounded-xl">
        <template #item.image="{ item }">
          <v-avatar size="40" rounded="lg">
            <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Pkg'" cover />
          </v-avatar>
        </template>

        <template #item.items="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="it in item.items"
              :key="it.foodId + '-' + it.qty"
              size="small"
              prepend-icon="mdi-silverware-fork-knife"
              variant="outlined"
            >
              {{ it.qty }}× {{ nameOfFood(it.foodId) }}
            </v-chip>
          </div>
        </template>

        <template #item.active="{ item }">
          <div class="d-flex justify-center">
            <v-switch
              inset hide-details
              :model-value="item.isActive"
              @update:modelValue="val => toggleActive(item, val)"
            />
          </div>
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
          <div class="text-medium-emphasis pa-6">No packages found.</div>
        </template>
      </v-data-table>
    </div>

    <!-- Dialog -->
    <v-dialog v-model="dialog" max-width="720">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Package' : 'New Package' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.name"
                  :items="PACKAGE_TYPES"
                  label="Package Type"
                  :rules="[rules.required]"
                  clearable
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.imageUrl" label="Image URL" />
              </v-col>
              <v-col cols="12">
                <v-textarea v-model="form.description" rows="3" label="Description" />
              </v-col>

              <v-col cols="12">
                <div class="d-flex align-center justify-space-between mb-2">
                  <h3 class="text-subtitle-1">Items</h3>
                  <v-btn size="small" variant="tonal" color="primary" @click="addLine">
                    <v-icon start>mdi-plus</v-icon> Add Item
                  </v-btn>
                </div>

                <v-table density="comfortable" class="rounded-lg">
                  <thead>
                    <tr>
                      <th style="width:60%">Food</th>
                      <th style="width:20%">Qty</th>
                      <th style="width:20%"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(it, idx) in form.items" :key="idx">
                      <td>
                        <v-select :items="foodOptions" v-model="it.foodId" placeholder="Select food" />
                      </td>
                      <td>
                        <v-text-field v-model.number="it.qty" type="number" min="1" />
                      </td>
                      <td class="text-right">
                        <v-btn icon size="small" color="red" variant="text" @click="removeLine(idx)">
                          <v-icon>mdi-delete</v-icon>
                        </v-btn>
                      </td>
                    </tr>
                    <tr v-if="form.items.length === 0">
                      <td colspan="3" class="text-center text-medium-emphasis">No items yet.</td>
                    </tr>
                  </tbody>
                </v-table>
                <div class="text-error mt-2" v-if="form.items.length === 0">Add at least one item</div>
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
