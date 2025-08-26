<script setup>
import api from '@/utils/api'
import { onMounted, ref } from 'vue'
const health = ref(null)
onMounted(async () => {
  const { data } = await api.get('/health')
  health.value = data
})
</script>

<template>
  <div>
    <h2>Admin Dashboard (MVP)</h2>
    <pre v-if="health">{{ health }}</pre>
  </div>
</template>
