<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api'

/* ───────────────────────────────
   State
──────────────────────────────── */
const loading = ref(false)
const rows = ref([])     // server data
const q = ref('')

const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)
const form = ref({ name: '', parentId: null, order: 0 })

/* ───────────────────────────────
   Table
──────────────────────────────── */
const headers = [
  { title: 'Name',   key: 'name' },
  { title: 'Slug',   key: 'slug' },
  { title: 'Parent', key: 'parent' },
  { title: 'Order',  key: 'order', align: 'center' },
  { title: 'Active', key: 'active', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false },
]

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return rows.value
  return rows.value.filter(r =>
    r.name.toLowerCase().includes(s) ||
    (r.slug || '').toLowerCase().includes(s)
  )
})

/* ───────────────────────────────
   CRUD
──────────────────────────────── */
async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value) params.set('q', q.value)
    const { data } = await api.get(`/categories?${params.toString()}`)
    rows.value = data
  } finally {
    loading.value = false
  }
}

function openCreate () {
  editing.value = null
  form.value = { name: '', parentId: null, order: nextOrder() }
  dialog.value = true
}

function openEdit (r) {
  editing.value = r
  form.value = {
    name: r.name,
    parentId: r.parentId || null,
    order: r.order ?? 0,
  }
  dialog.value = true
}

async function save () {
  const ok = await formRef.value?.validate()
  if (!ok?.valid) return

  const payload = {
    name: form.value.name.trim(),
    parentId: form.value.parentId || null,
    order: Number(form.value.order || 0),
  }

  if (editing.value) {
    const { data } = await api.put(`/categories/${editing.value._id}`, payload)
    patchRow(data)
  } else {
    const { data } = await api.post('/categories', payload)
    rows.value.unshift(data)
  }
  dialog.value = false
}

function patchRow (row) {
  const i = rows.value.findIndex(r => r._id === row._id)
  if (i !== -1) rows.value[i] = row
}

async function toggle (r, value) {
  const { data } = await api.patch(`/categories/${r._id}/toggle`, { value })
  patchRow(data)
}

async function removeOne (r) {
  if (!confirm(`Delete category "${r.name}"?`)) return
  try {
    await api.delete(`/categories/${r._id}`)
    rows.value = rows.value.filter(x => x._id !== r._id)
  } catch (e) {
    const msg = e?.response?.data?.message || 'Cannot delete'
    const n = e?.response?.data?.foodCount
    alert(n != null ? `${msg}. Foods attached: ${n}` : msg)
  }
}

/* ───────────────────────────────
   Helpers
──────────────────────────────── */
function nextOrder () {
  if (rows.value.length === 0) return 0
  const max = Math.max(...rows.value.map(r => Number(r.order || 0)))
  return (isFinite(max) ? max : 0) + 1
}

function parentName (row) {
  return rows.value.find(r => r._id === row.parentId)?.name || '—'
}

const parentOptions = computed(() => [
  { title: '— None —', value: null },
  ...rows.value.map(r => ({ title: r.name, value: r._id })),
])

const rules = {
  required: v => !!String(v).trim() || 'Required',
  nonneg:   v => Number(v) >= 0 || 'Must be ≥ 0',
}

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl">
    <!-- Toolbar (new style: Refresh + New) -->
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Categories</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn color="white" variant="flat" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> New
        </v-btn>
      </template>
    </v-toolbar>

    <!-- Filters -->
    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="q"
            label="Search category"
            prepend-inner-icon="mdi-magnify"
            clearable
            @keyup.enter="load"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" @click="load" block>
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <!-- Table -->
      <v-data-table
        :headers="headers"
        :items="filtered"
        :items-per-page="10"
        class="rounded-xl"
      >
        <template #item.parent="{ item }">
          {{ parentName(item) }}
        </template>

        <template #item.order="{ item }">
          <div class="text-center">{{ item.order ?? 0 }}</div>
        </template>

        <template #item.active="{ item }">
          <div class="d-flex justify-center">
            <v-switch
              inset
              :model-value="item.isActive"
              hide-details
              @change="toggle(item, $event)"
            />
          </div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn size="small" variant="tonal" color="primary" @click="openEdit(item)">
              <v-icon start>mdi-pencil</v-icon> Edit
            </v-btn>
            <v-btn size="small" variant="text" color="red" @click="removeOne(item)">
              <v-icon start>mdi-delete</v-icon> Delete
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- Dialog -->
    <v-dialog v-model="dialog" max-width="560">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Category' : 'New Category' }}</v-card-title>

        <v-card-text>
          <v-form ref="formRef">
            <v-row dense>
              <v-col cols="12">
                <v-text-field
                  v-model="form.name"
                  label="Name"
                  :rules="[rules.required]"
                  autofocus
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-select
                  :items="parentOptions"
                  v-model="form.parentId"
                  label="Parent"
                />
              </v-col>

              <v-col cols="12" md="6">
                <v-text-field
                  v-model.number="form.order"
                  type="number"
                  min="0"
                  label="Order"
                  :rules="[rules.nonneg]"
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
  </v-card>
  <v-fab icon="mdi-plus" app location="bottom end" color="primary" @click="openCreate" />

</template>

<style scoped>
/* small visual tweaks */
.v-switch .v-label { font-size: 12px }
</style>
