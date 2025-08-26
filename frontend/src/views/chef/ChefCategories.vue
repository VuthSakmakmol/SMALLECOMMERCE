<script setup>
import { onMounted, ref } from 'vue'
import api from '@/utils/api'

const rows = ref([])
const form = ref({ name: '', order: 0 })
const loading = ref(false)
const saving = ref(false)

const load = async () => {
  loading.value = true
  try { rows.value = (await api.get('/categories')).data }
  finally { loading.value = false }
}
const createOne = async () => { saving.value = true; await api.post('/categories', form.value); form.value={name:'',order:0}; await load(); saving.value=false }
const toggle = async (id, v) => { await api.patch(`/categories/${id}/toggle`, { value: v }); await load() }
const removeOne = async (id) => { if(!confirm('Delete?'))return; await api.delete(`/categories/${id}`); await load() }
onMounted(load)
</script>

<template>
  <div>
    <h2>Categories</h2>
    <div class="mb-4" style="max-width:420px">
      <v-text-field v-model="form.name" label="Name" />
      <v-text-field v-model.number="form.order" type="number" label="Order" />
      <v-btn :loading="saving" color="primary" @click="createOne">Add</v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate />
    <v-table v-else>
      <thead><tr><th>Name</th><th>Order</th><th>Active</th><th></th></tr></thead>
      <tbody>
        <tr v-for="c in rows" :key="c._id">
          <td>{{ c.name }}</td><td>{{ c.order }}</td>
          <td><v-switch :model-value="c.isActive" @update:model-value="v=>toggle(c._id,v)" inset density="compact"/></td>
          <td><v-btn size="small" color="error" @click="removeOne(c._id)">Delete</v-btn></td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
