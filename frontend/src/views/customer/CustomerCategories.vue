<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

const router = useRouter()
const loading = ref(false)
const rows = ref([])

async function load () {
  loading.value = true
  try {
    const { data } = await api.get('/categories?activeOnly=true')
    rows.value = data
  } finally { loading.value = false }
}

function go (id) {
  // go to browse and filter (browse listens to cat + reload)
  router.push({ name: 'customer-browse', query: { cat: id } })
}

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Categories</v-toolbar-title>
      <template #append>
        <v-btn color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row>
        <v-col v-for="c in rows" :key="c._id" cols="12" sm="6" md="4" lg="3">
          <v-card class="rounded-xl" @click="go(c._id)" role="button">
            <v-card-title>{{ c.name }}</v-card-title>
            <v-card-subtitle class="text-medium-emphasis">{{ c.slug }}</v-card-subtitle>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </v-card>
</template>
