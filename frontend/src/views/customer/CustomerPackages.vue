<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/utils/api'
import { useCart } from '@/store/cart'

const router = useRouter()
const cart = useCart()

/* ───── state ───── */
const loading   = ref(false)
const packages  = ref([])
const foods     = ref([])
const q         = ref('')

/* cart drawer + snack */
const cartOpen  = ref(false)
const snack     = ref({ show:false, text:'' })
const notify = (t) => (snack.value = { show:true, text:t })

/* qty dialog */
const qtyDialog   = ref(false)
const selectedPkg = ref(null)
const qty         = ref(1)

/* ───── food lookup for names + thumbnails ───── */
const foodsById = computed(() => {
  const m = new Map()
  for (const f of foods.value) m.set(f._id, f)
  return m
})
const nameOfFood  = (id) => foodsById.value.get(id)?.name     || '—'
const imageOfFood = (id) => foodsById.value.get(id)?.imageUrl || 'https://via.placeholder.com/56x56?text=Food'

/* ───── filter ───── */
const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return packages.value
  return packages.value.filter(p =>
    p.name.toLowerCase().includes(term) ||
    (p.description || '').toLowerCase().includes(term) ||
    (p.items || []).some(it => (nameOfFood(it.foodId) || '').toLowerCase().includes(term))
  )
})

/* ───── loaders ───── */
async function loadFoods() {
  const { data } = await api.get('/foods?activeOnly=true')
  foods.value = data
}
async function loadPackages() {
  loading.value = true
  try {
    const { data } = await api.get('/packages?activeOnly=true')
    packages.value = data
  } finally {
    loading.value = false
  }
}
async function refresh() {
  loading.value = true
  try {
    await Promise.all([loadFoods(), loadPackages()])
  } finally {
    loading.value = false
  }
}

/* ───── cart actions ───── */
function quickAdd(pkg) {
  cart.addPackage(pkg, 1)
  cartOpen.value = true
  notify(`Added: ${pkg.name}`)
}
function openQty(pkg) {
  selectedPkg.value = pkg
  qty.value = 1
  qtyDialog.value = true
}
function confirmQty() {
  if (!selectedPkg.value) return
  const n = Math.max(1, Number(qty.value) || 1)
  cart.addPackage(selectedPkg.value, n)
  qtyDialog.value = false
  cartOpen.value = true
  notify(`Added ${n}× ${selectedPkg.value.name}`)
}

/* ───── place order (same shape as your CustomerBrowse.vue) ───── */
async function placeOrder () {
  if (!cart.hasItems) return

  const type = String(cart.orderType || 'INDIVIDUAL').toUpperCase()

  const payload = {
    type,
    notes: cart.notes || '',
    items: cart.items
      .map(i => ({
        kind: i.kind, // 'FOOD' | 'PACKAGE'
        foodId:    i.kind === 'FOOD'    ? i.id : undefined,
        packageId: i.kind === 'PACKAGE' ? i.id : undefined,
        qty: Math.max(1, parseInt(i.qty, 10) || 1)
      }))
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

onMounted(refresh)
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Customer – Packages</v-toolbar-title>
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
      <!-- Search -->
      <v-row dense class="mb-4">
        <v-col cols="12" md="6">
          <v-text-field
            v-model="q"
            density="compact"
            variant="outlined"
            label="Search packages"
            prepend-inner-icon="mdi-magnify"
            clearable
          />
        </v-col>
      </v-row>

      <!-- Grid of packages -->
      <v-row dense>
        <v-col v-for="pkg in filtered" :key="pkg._id" cols="12" sm="6" md="4" lg="3">
          <v-card class="rounded-xl h-100 d-flex flex-column">
            <v-img
              :src="pkg.imageUrl || 'https://via.placeholder.com/640x360?text=Package'"
              aspect-ratio="16/9"
              cover
              class="rounded-t-xl"
            />

            <div class="pa-3 flex-grow-1">
              <div class="d-flex align-center justify-space-between">
                <h3 class="text-subtitle-1 font-weight-bold">{{ pkg.name }}</h3>
                <v-chip v-if="pkg.isActive" size="small" color="success" variant="tonal">Active</v-chip>
              </div>

              <p class="text-body-2 text-medium-emphasis mt-1" v-if="pkg.description">
                {{ pkg.description }}
              </p>

              <!-- Included foods with thumbnails -->
              <div class="mt-2">
                <div class="text-caption text-medium-emphasis mb-1">Includes:</div>
                <div class="d-flex flex-wrap gap-2">
                  <div
                    v-for="it in pkg.items"
                    :key="it.foodId + '-' + it.qty"
                    class="d-flex align-center ga-2 item-pill"
                  >
                    <v-avatar size="28" rounded="lg">
                      <v-img :src="imageOfFood(it.foodId)" cover />
                    </v-avatar>
                    <span class="text-caption">
                      ×{{ it.qty }} {{ nameOfFood(it.foodId) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <v-divider />

            <div class="pa-3 d-flex ga-2">
              <v-btn block color="primary" variant="elevated" @click="quickAdd(pkg)">
                <v-icon start>mdi-cart-plus</v-icon> Add
              </v-btn>
              <v-btn block variant="tonal" @click="openQty(pkg)">
                <v-icon start>mdi-numeric</v-icon> Add with Qty
              </v-btn>
            </div>
          </v-card>
        </v-col>

        <!-- Empty -->
        <v-col cols="12" v-if="!loading && filtered.length === 0">
          <v-alert type="info" variant="tonal" class="rounded-xl">
            No packages found. Try clearing the search.
          </v-alert>
        </v-col>
      </v-row>
    </div>

    <!-- Cart Drawer (same UX as CustomerBrowse.vue) -->
    <v-navigation-drawer v-model="cartOpen" location="right" temporary width="420">
      <v-toolbar flat>
        <v-toolbar-title>Cart ({{ cart.count }})</v-toolbar-title>
        <v-spacer/><v-btn icon @click="cartOpen=false"><v-icon>mdi-close</v-icon></v-btn>
      </v-toolbar>

      <div class="pa-3">
        <v-list density="comfortable">
          <v-list-item v-for="it in cart.items" :key="it.key">
            <template #prepend>
              <v-chip size="x-small" class="mr-2" :color="it.kind==='PACKAGE' ? 'purple' : 'primary'">
                {{ it.kind }}
              </v-chip>
            </template>

            <v-list-item-title>{{ it.name }}</v-list-item-title>

            <!-- Show package foods with thumbnails -->
            <div v-if="it.kind==='PACKAGE' && Array.isArray(it.items) && it.items.length" class="mt-2">
              <div class="text-caption text-medium-emphasis mb-1">Includes:</div>
              <div class="d-flex flex-wrap ga-2">
                <div
                  v-for="pi in it.items"
                  :key="pi.foodId"
                  class="d-flex align-center ga-2 item-pill"
                >
                  <v-avatar size="28" rounded="lg">
                    <v-img
                      :src="(foodsById.get(pi.foodId)?.imageUrl) || 'https://via.placeholder.com/56x56?text=Food'"
                      cover
                    />
                  </v-avatar>
                  <span class="text-caption">
                    ×{{ pi.qty }}
                    {{ foodsById.get(pi.foodId)?.name || 'Unknown' }}
                  </span>
                </div>
              </div>
            </div>

            <template #append>
              <div class="d-flex align-center ga-2">
                <v-btn icon size="x-small" variant="tonal" @click="cart.dec(it)"><v-icon>mdi-minus</v-icon></v-btn>
                <div class="text-subtitle-2" style="min-width:24px;text-align:center">{{ it.qty }}</div>
                <v-btn icon size="x-small" variant="tonal" @click="cart.inc(it)"><v-icon>mdi-plus</v-icon></v-btn>
                <v-btn icon size="x-small" variant="text" color="red" @click="cart.remove(it)"><v-icon>mdi-delete</v-icon></v-btn>
              </div>
            </template>
          </v-list-item>

          <v-list-item v-if="!cart.items.length">
            <v-list-item-title class="text-medium-emphasis">Your cart is empty.</v-list-item-title>
          </v-list-item>
        </v-list>

        <v-divider class="my-3"/>

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
        <v-textarea v-model="cart.notes" rows="2" label="Notes (optional)"/>

        <div class="d-flex justify-end mt-2">
          <v-btn color="primary" :disabled="!cart.hasItems" @click="placeOrder">
            <v-icon start>mdi-check</v-icon> Place order
          </v-btn>
        </div>
      </div>
    </v-navigation-drawer>

    <!-- Floating Cart Button -->
    <v-btn class="cart-fab" size="large" color="primary" icon @click="cartOpen = true">
      <v-badge :content="cart.count" :model-value="cart.count>0" overlap>
        <v-icon>mdi-cart</v-icon>
      </v-badge>
    </v-btn>

    <!-- Snack -->
    <v-snackbar v-model="snack.show" timeout="1500" location="bottom right">
      {{ snack.text }}
    </v-snackbar>
  </v-card>
</template>

<style scoped>
.item-pill{
  border:1px solid var(--v-theme-outline);
  padding:6px 10px;
  border-radius:10px;
}
.cart-fab {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 10;
}
</style>
