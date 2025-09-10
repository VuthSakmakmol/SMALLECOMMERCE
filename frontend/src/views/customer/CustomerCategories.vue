<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'

const router = useRouter()
const loading = ref(false)
const rows = ref([])
const q = ref('')

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.set('activeOnly', 'true')
    if (q.value.trim()) params.set('q', q.value.trim())
    const { data } = await api.get(`/categories?${params.toString()}`)
    rows.value = Array.isArray(data) ? data : (data?.data || [])
  } finally {
    loading.value = false
  }
}

function go (id) {
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
      <v-row dense class="mb-3">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="q"
            label="Search categories"
            density="compact"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            clearable
            @keyup.enter="load"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="load">
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <v-row v-if="loading" dense>
        <v-col v-for="n in 8" :key="n" cols="12" sm="6" md="4" lg="3" class="mb-3">
          <v-skeleton-loader type="image, text" class="rounded-xl" />
        </v-col>
      </v-row>

      <v-row v-else dense>
        <v-col
          v-for="c in rows"
          :key="c._id"
          cols="12" sm="6" md="4" lg="3"
          class="mb-3"
        >
          <v-card class="rounded-xl hover-elev" @click="go(c._id)" role="button">
            <v-img
              :src="c.imageUrl || 'https://via.placeholder.com/600x360?text=Category'"
              height="140"
              cover
              class="rounded-t-xl"
            />
            <v-card-title class="text-subtitle-1 d-flex align-center">
              <v-icon class="mr-2" color="primary">mdi-tag</v-icon>
              {{ c.name }}
            </v-card-title>
            <v-card-subtitle class="text-medium-emphasis px-4 pb-4">
              {{ c.slug }}
            </v-card-subtitle>
          </v-card>
        </v-col>

        <v-col v-if="!rows.length" cols="12">
          <div class="text-center text-medium-emphasis py-8">
            <v-icon size="36" class="mb-2">mdi-tag-off-outline</v-icon>
            <div>No categories found.</div>
          </div>
        </v-col>
      </v-row>
    </div>
  </v-card>
</template>

<style scoped>
.hover-elev:hover { box-shadow: var(--v-theme-shadow-8) !important; cursor: pointer; }
</style>
