<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

const foods = ref([])
const loading = ref(false)

const load = async () => {
  loading.value = true
  try { foods.value = (await api.get('/foods', { params:{ activeOnly: true } })).data }
  finally { loading.value = false }
}

const setLimit = async (f, limit) => {
  const dailyLimit = limit === '' ? null : Number(limit)
  await api.patch(`/foods/${f._id}/stock`, { dailyLimit })
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <h2>Availability (Portions for today)</h2>
    <p class="text-body-2 mb-3">Set how many portions are available today. When it reaches 0, the item shows "Out of stock" to customers.</p>

    <v-progress-linear v-if="loading" indeterminate />
    <v-table v-else>
      <thead>
        <tr><th>Food</th><th>Category</th><th>Limit (today)</th><th>Remaining</th><th>Status</th></tr>
      </thead>
      <tbody>
        <tr v-for="f in foods" :key="f._id">
          <td>{{ f.name }}</td>
          <td>{{ f.categoryId?.name || '—' }}</td>
          <td style="max-width:140px">
            <v-text-field
              :model-value="f.dailyLimit ?? ''"
              type="number" density="compact" hide-details
              placeholder="e.g., 10"
              @change="e => setLimit(f, e.target.value)"
            />
          </td>
          <td>{{ f.stockRemaining ?? '—' }}</td>
          <td>
            <v-chip :color="(f.stockRemaining ?? Infinity) <= 0 ? 'error' : 'success'" size="small" variant="tonal">
              {{ (f.stockRemaining ?? Infinity) <= 0 ? 'Out of stock' : 'Available' }}
            </v-chip>
          </td>
        </tr>
      </tbody>
    </v-table>
  </div>
</template>
