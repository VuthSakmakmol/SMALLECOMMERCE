<script setup>
import { onMounted, ref } from 'vue'
import api from '@/utils/api'
const health = ref(null)
onMounted(async () => {
  const { data } = await api.get('/health')
  health.value = data
})
</script>

<template>
  <div>
    <h2 class="mb-4">Dashboard</h2>
    <v-row dense>
      <v-col cols="12" md="3"><v-card class="pa-4"><h3>Total Orders</h3><div class="text-h5">—</div></v-card></v-col>
      <v-col cols="12" md="3"><v-card class="pa-4"><h3>Pending</h3><div class="text-h5">—</div></v-card></v-col>
      <v-col cols="12" md="3"><v-card class="pa-4"><h3>Cooking</h3><div class="text-h5">—</div></v-card></v-col>
      <v-col cols="12" md="3"><v-card class="pa-4"><h3>Ready/Done</h3><div class="text-h5">—</div></v-card></v-col>
    </v-row>

    <v-card class="mt-6">
      <v-card-title>System health</v-card-title>
      <v-card-text><pre>{{ health }}</pre></v-card-text>
    </v-card>
  </div>
</template>
