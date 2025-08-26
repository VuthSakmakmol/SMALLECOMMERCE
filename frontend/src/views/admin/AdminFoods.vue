<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

const foods = ref([])
const cats = ref([])
const loading = ref(false)
const saving = ref(false)
const form = ref({ name: '', categoryId: '', description: '', imageUrl: '', tags: [] })
const selectedCat = ref('')

const load = async () => {
  loading.value = true
  try {
    const [fc, cc] = await Promise.all([
      api.get('/foods', { params: { categoryId: selectedCat.value || undefined } }),
      api.get('/categories', { params: { activeOnly: true } })
    ])
    foods.value = fc.data
    cats.value = cc.data
  } finally { loading.value = false }
}

const createFood = async () => {
  if (!form.value.name || !form.value.categoryId) return
  saving.value = true
  try {
    await api.post('/foods', form.value)
    form.value = { name: '', categoryId: '', description: '', imageUrl: '', tags: [] }
    await load()
  } finally { saving.value = false }
}

const toggle = async (id, scope, value) => {
  await api.patch(`/foods/${id}/toggle`, { scope, value })
  await load()
}

const removeOne = async (id) => {
  if (!confirm('Delete this food?')) return
  await api.delete(`/foods/${id}`)
  await load()
}

const catName = (id) => cats.value.find(c => c._id === id)?.name || '—'

onMounted(load)
</script>

<template>
  <div class="pa-2">
    <h2>Foods</h2>

    <div class="d-flex mb-4" style="gap:16px;max-width:900px;flex-wrap:wrap">
      <v-text-field v-model="form.name" label="Food name" />
      <v-select  v-model="form.categoryId" :items="cats" label="Category" item-title="name" item-value="_id" />
      <v-text-field v-model="form.imageUrl" label="Image URL (optional)" />
      <v-text-field v-model="form.description" label="Description (optional)" />
      <v-btn :loading="saving" color="primary" @click="createFood">Add Food</v-btn>
    </div>

    <div class="mb-3" style="max-width:280px">
      <v-select v-model="selectedCat" :items="cats" label="Filter by category" item-title="name" item-value="_id" clearable @update:model-value="load" />
    </div>

    <v-progress-linear v-if="loading" indeterminate />
    <v-table v-else>
      <thead>
        <tr>
          <th>Name</th>
          <th>Category</th>
          <th>Global</th>
          <th>Kitchen</th>
          <th>Effective</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="f in foods" :key="f._id">
          <td>{{ f.name }}</td>
          <td>{{ f.categoryId?.name || catName(f.categoryId) }}</td>
          <td>
            <v-switch :model-value="f.isActiveGlobal" @update:model-value="v => toggle(f._id, 'GLOBAL', v)" inset density="compact" />
          </td>
          <td>
            <v-switch :model-value="f.isActiveKitchen" @update:model-value="v => toggle(f._id, 'KITCHEN', v)" inset density="compact" />
          </td>
          <td>{{ f.isActiveGlobal && f.isActiveKitchen ? 'Active' : 'Inactive' }}</td>
          <td><v-btn size="small" color="error" @click="removeOne(f._id)">Delete</v-btn></td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
