<!-- src/views/customer/CustomerBrowse.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Cart from '@/components/Cart.vue'
import { useCart } from '@/store/cart'
import api from '@/utils/api'

const router = useRouter()
const route  = useRoute()
const cart   = useCart()

/* ---------- state ---------- */
const loading    = ref(false)
const categories = ref([])
const foods      = ref([])
const packages   = ref([])

const q   = ref('')
const cat = ref('ALL')
const tab = ref('foods')

const cartOpen = ref(false)
const snack    = ref({ show:false, text:'' })
const notify   = t => (snack.value = { show:true, text:t })

const categoryOptions = computed(() => [
  { title: 'All Categories', value: 'ALL' },
  ...categories.value.map(c => ({ title: c.name, value: c._id }))
])

/* ---------- load ---------- */
async function loadCats () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = Array.isArray(data) ? data : (data?.data || [])
}
async function loadFoods () {
  const p = new URLSearchParams({ activeOnly: 'true' })
  if (q.value) p.set('q', q.value)
  if (cat.value !== 'ALL') p.set('categoryId', cat.value)
  const { data } = await api.get(`/foods?${p.toString()}`)
  foods.value = Array.isArray(data) ? data : (data?.data || [])
}
async function loadPkgs () {
  const p = new URLSearchParams({ activeOnly: 'true' })
  if (q.value) p.set('q', q.value)
  const { data } = await api.get(`/packages?${p.toString()}`)
  packages.value = Array.isArray(data) ? data : (data?.data || [])
}
async function refresh () {
  loading.value = true
  try {
    await Promise.all([loadCats(), loadFoods(), loadPkgs()])
  } finally {
    loading.value = false
  }
}

/* ---------- stock helpers (new stockQty model) ---------- */
function canAddFood (f) {
  // null = unlimited
  if (f.stockQty === null || f.stockQty === undefined) return true
  const key       = `FOOD:${f._id}`
  const inCartQty = cart.items.find(i => i.key === key)?.qty || 0
  return inCartQty < Number(f.stockQty)
}

function addFood (f) {
  if (!canAddFood(f)) return alert('No more stock available.')
  cart.addFood(f, 1)        // your Pinia action (expects full food object)
  cartOpen.value = true
  notify(`Added: ${f.name}`)
}
function addPackage (p) {
  cart.addPackage(p, 1)     // your Pinia action (expects full package object)
  cartOpen.value = true
  notify(`Added package: ${p.name}`)
}

/* ---------- place order ---------- */
async function placeOrder () {
  if (!cart.hasItems) return

  const type = String(cart.orderType || 'INDIVIDUAL').toUpperCase()
  const payload = {
    type,
    notes: cart.notes || '',
    items: cart.items
      .map(i => {
        const base = {
          kind: i.kind, // 'FOOD' | 'PACKAGE'
          qty: Math.max(1, parseInt(i.qty, 10) || 1),
        }
        if (i.kind === 'FOOD') {
          base.foodId = i.id
          // include selections for server normalization
          base.ingredients = (i.ingredients || []).map(x => ({
            ingredientId: x.ingredientId,
            included: !!x.included,
            value: x.value ?? null
          }))
          base.groups = (i.groups || []).map(g => ({
            groupId: g.groupId,
            choice: g.choice ?? null
          }))
        } else if (i.kind === 'PACKAGE') {
          base.packageId = i.id
        }
        return base
      })
      .filter(x => (x.kind === 'FOOD' && x.foodId) || (x.kind === 'PACKAGE' && x.packageId))
  }

  if (type === 'GROUP' && cart.groupKey && String(cart.groupKey).trim()) {
    payload.groupKey = String(cart.groupKey).trim()
  }

  try {
    await api.post('/orders', payload)
    cart.clear()
    cartOpen.value = false
    router.push('/customer/history')
  } catch (err) {
    const msg =
      err?.response?.data?.message ||
      (Array.isArray(err?.response?.data?.errors) &&
        err.response.data.errors.map(e => e.msg || e.message).join('\n')) ||
      err?.message || 'Failed to place order'
    alert(msg)
    console.error('[Place Order] payload:', payload)
    console.error('[Place Order] error:', err?.response?.data || err)
  }
}

/* ---------- init ---------- */
onMounted(async () => {
  if (route.query.cat) cat.value = String(route.query.cat)
  await refresh()
})
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Browse</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="refresh">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn color="white" variant="flat" @click="cartOpen = true">
          <v-icon start>mdi-cart</v-icon> Cart ({{ cart.count }})
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="5">
          <v-text-field
            v-model="q"
            label="Search foods or packages"
            density="compact"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            clearable
            @keyup.enter="refresh"
          />
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :items="categoryOptions"
            density="compact"
            variant="outlined"
            v-model="cat"
            label="Category"
            :disabled="tab!=='foods'"
            @update:modelValue="loadFoods"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="refresh">
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <v-tabs v-model="tab" class="mb-4">
        <v-tab value="foods">Foods</v-tab>
        <v-tab value="packages">Packages</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <!-- Foods -->
        <v-window-item value="foods">
          <v-row>
            <v-col
              v-for="f in foods"
              :key="f._id"
              cols="12" sm="6" md="4" lg="3"
              class="mb-4"
            >
              <v-card class="h-100 rounded-xl">
                <v-img :src="f.imageUrl || 'https://via.placeholder.com/600x400?text=Food'" height="270" cover />
                <v-card-title class="text-subtitle-1">{{ f.name }}</v-card-title>
                <v-card-subtitle>{{ f.categoryId?.name || '—' }}</v-card-subtitle>
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">
                    {{ f.description || ' ' }}
                  </div>
                  <div class="d-flex align-center justify-space-between">
                    <v-chip size="small" color="green" variant="tonal" v-if="f.stockQty === null">
                      In stock: Unlimited
                    </v-chip>
                    <v-chip size="small" color="orange" variant="tonal" v-else>
                      In stock: {{ f.stockQty }}
                    </v-chip>
                    <div class="text-caption">
                      Tags: {{ (f.tags || []).join(', ') || '—' }}
                    </div>
                  </div>
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn color="primary" :disabled="!canAddFood(f)" @click.stop="addFood(f)">
                    <v-icon start>mdi-cart-plus</v-icon> Add
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </v-window-item>

        <!-- Packages -->
        <v-window-item value="packages">
          <v-row>
            <v-col
              v-for="p in packages"
              :key="p._id"
              cols="12" sm="6" md="4" lg="3"
              class="mb-4"
            >
              <v-card class="h-100 rounded-xl">
                <v-img :src="p.imageUrl || 'https://via.placeholder.com/600x400?text=Package'" height="270" cover />
                <v-card-title class="text-subtitle-1">{{ p.name }}</v-card-title>
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">
                    {{ p.description || ' ' }}
                  </div>
                  <div class="d-flex flex-wrap ga-1">
                    <v-chip
                      v-for="it in p.items"
                      :key="it.foodId"
                      size="x-small"
                      variant="outlined"
                    >
                      ×{{ it.qty }}
                    </v-chip>
                  </div>
                </v-card-text>
                <v-card-actions>
                  <v-spacer />
                  <v-btn color="primary" @click.stop="addPackage(p)">
                    <v-icon start>mdi-cart-plus</v-icon> Add
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </v-window-item>
      </v-window>
    </div>

    <!-- Cart drawer (with customization dialog inside) -->
    <Cart v-model="cartOpen" @place="placeOrder">
      <template #extras>
        <v-select
          :items="[
            { title:'Individual', value:'INDIVIDUAL' },
            { title:'Group', value:'GROUP' },
            { title:'Workshop', value:'WORKSHOP' }
          ]"
          v-model="cart.orderType"
          label="Order type"
        />
        <v-text-field
          v-if="cart.orderType==='GROUP'"
          v-model="cart.groupKey"
          label="Group code (optional)"
          density="comfortable"
        />
        <v-textarea v-model="cart.notes" rows="2" label="Notes (optional)" />
      </template>
    </Cart>

    <!-- Floating Cart button -->
    <v-btn class="cart-fab" size="large" color="primary" icon @click="cartOpen = true">
      <v-badge :content="cart.count" :model-value="cart.count > 0" overlap>
        <v-icon>mdi-cart</v-icon>
      </v-badge>
    </v-btn>

    <v-snackbar v-model="snack.show" timeout="1500" location="bottom right">
      {{ snack.text }}
    </v-snackbar>
  </v-card>
</template>

<style scoped>
.cart-fab { position: fixed; right: 20px; bottom: 20px; z-index: 10; }
</style>
