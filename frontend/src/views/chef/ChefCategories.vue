<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const q = ref('')

/* ✂ Removed Parent + Order headers */
const headers = [
  { title: 'Name',   key: 'name' },
  { title: 'Slug',   key: 'slug' },
  { title: 'Active', key: 'active', align: 'center' },
]

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
    rows.value = data
  } finally {
    loading.value = false
  }
}

async function toggle (row, value) {
  const { data } = await api.patch(`/categories/${row._id}/toggle`, { value })
  const i = rows.value.findIndex(r => r._id === data._id)
  if (i !== -1) rows.value[i] = data
}

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl">
    <!-- Toolbar -->
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Categories</v-toolbar-title>
      <template #append>
        <v-btn color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
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
      </v-data-table>
    </div>
  </v-card>
</template>

<style scoped>
.v-switch .v-label { font-size: 12px }
</style>
