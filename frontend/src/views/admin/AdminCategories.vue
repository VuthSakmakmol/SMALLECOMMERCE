<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const q = ref('')

const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)
const form = ref({ name: '', imageUrl: '' })

const headers = [
  { title: 'Image',  key: 'image',  sortable: false },
  { title: 'Name',   key: 'name' },
  { title: 'Slug',   key: 'slug' },
  { title: 'Active', key: 'active', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'end', sortable: false }
]

const rules = {
  required: v => !!String(v).trim() || 'Required',
}

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return rows.value
  return rows.value.filter(r =>
    r.name.toLowerCase().includes(s) ||
    (r.slug || '').toLowerCase().includes(s)
  )
})

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value) params.set('q', q.value)
    const { data } = await api.get(`/categories?${params.toString()}`)
    rows.value = Array.isArray(data) ? data : (data?.data || [])
  } finally { loading.value = false }
}

function openCreate () {
  editing.value = null
  form.value = { name: '', imageUrl: '' }
  dialog.value = true
}

function openEdit (r) {
  editing.value = r
  form.value = { name: r.name, imageUrl: r.imageUrl || '' }
  dialog.value = true
}

function patchRow (row) {
  const i = rows.value.findIndex(r => r._id === row._id)
  if (i !== -1) rows.value[i] = row
}

async function save () {
  const ok = await formRef.value?.validate()
  if (!ok?.valid) return
  const payload = { name: form.value.name.trim(), imageUrl: form.value.imageUrl || '' }

  if (editing.value) {
    const { data } = await api.put(`/categories/${editing.value._id}`, payload)
    patchRow(data)
  } else {
    const { data } = await api.post('/categories', payload)
    rows.value.unshift(data)
  }
  dialog.value = false
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

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl">
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

    <div class="pa-4">
      <v-row dense class="mb-2">
        <v-col cols="12" md="3">
          <v-text-field
            v-model="q"
            density="compact"
            variant="outlined"
            label="Search category"
            prepend-inner-icon="mdi-magnify"
            clearable
            @keyup.enter="load"
          />
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="filtered" :items-per-page="10" class="rounded-xl">
        <template #item.image="{ item }">
          <v-avatar size="40" rounded="lg">
            <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Category'" cover />
          </v-avatar>
        </template>

        <template #item.active="{ item }">
          <div class="d-flex justify-center">
            <v-switch
              inset
              :model-value="item.isActive"
              hide-details
              @update:modelValue="val => toggle(item, val)"
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

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Category' : 'New Category' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-text-field v-model="form.name" label="Name" :rules="[rules.required]" autofocus />
            <v-text-field v-model="form.imageUrl" label="Image URL" placeholder="https://..." />
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

    <v-fab icon="mdi-plus" app location="bottom end" color="primary" @click="openCreate" />
  </v-card>
</template>
