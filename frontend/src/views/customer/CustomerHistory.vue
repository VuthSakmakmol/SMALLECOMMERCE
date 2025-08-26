<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

const rows = ref([]); const loading = ref(false)
const load = async () => {
  loading.value = true
  try { rows.value = (await api.get('/orders', { params:{ scope:'CUSTOMER' } })).data }
  finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <h2>My Orders</h2>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />
    <v-table v-else>
      <thead>
        <tr><th>ID</th><th>Status</th><th>Items</th><th>Created</th></tr>
      </thead>
      <tbody>
        <tr v-for="o in rows" :key="o._id">
          <td>#{{ o._id.slice(-6) }}</td>
          <td>{{ o.status }}</td>
          <td>{{ o.items.map(i => (i.qty||1)+'× '+i.nameSnapshot).join(', ') }}</td>
          <td>{{ new Date(o.createdAt).toLocaleString() }}</td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
