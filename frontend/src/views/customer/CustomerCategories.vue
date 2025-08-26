<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

const cats = ref([]); const foods = ref([])
const loading = ref(false); const selected = ref(null)

const load = async () => {
  loading.value = true
  try {
    const [c,f] = await Promise.all([
      api.get('/categories', { params:{ activeOnly:true }}),
      api.get('/foods', { params:{ activeOnly:true }})
    ])
    cats.value = c.data; foods.value = f.data
    if (!selected.value && cats.value.length) selected.value = cats.value[0]._id
  } finally { loading.value = false }
}
const visibleFoods = () => foods.value.filter(f => (f.categoryId?._id || f.categoryId) === selected.value)

onMounted(load)
</script>

<template>
  <div>
    <h2>Categories</h2>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />
    <v-chip-group v-model="selected" column>
      <v-chip v-for="c in cats" :key="c._id" :value="c._id" variant="tonal">{{ c.name }}</v-chip>
    </v-chip-group>

    <v-row dense class="mt-3">
      <v-col cols="12" sm="6" md="4" v-for="f in visibleFoods()" :key="f._id">
        <v-card>
          <v-img v-if="f.imageUrl" :src="f.imageUrl" height="140" cover />
          <v-card-title>{{ f.name }}</v-card-title>
          <v-card-subtitle v-if="f.description">{{ f.description }}</v-card-subtitle>
          <v-card-text>
            <v-chip v-if="f.stockRemaining === 0" color="error" size="small" variant="tonal">Out of stock</v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
