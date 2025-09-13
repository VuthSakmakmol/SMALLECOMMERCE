<!-- src/views/customer/CustomerBrowse.vue -->
<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Cart from '@/components/Cart.vue'
import { useCart } from '@/store/cart'
import api from '@/utils/api'

const router = useRouter()
const route  = useRoute()
const cart   = useCart()

/* ---------- state ---------- */
const loading    = ref(false)
const categories = ref([])   // fetched dynamically
const foods      = ref([])   // all active foods
const packages   = ref([])   // all active packages

const q   = ref('')
const tab = ref('all')       // tabs: all | packages

const cartOpen = ref(false)
const snack    = ref({ show:false, text:'' })
const notify   = t => (snack.value = { show:true, text:t })

/* ---------- load ---------- */
async function loadCats () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = Array.isArray(data) ? data : (data?.data || [])
}
async function loadFoods () {
  const p = new URLSearchParams({ activeOnly: 'true' })
  if (q.value) p.set('q', q.value)
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

/* ---------- stock helpers ---------- */
function canAddFood (f) {
  if (f.stockQty === null || f.stockQty === undefined) return true
  const key       = `FOOD:${f._id}`
  const inCartQty = cart.items.find(i => i.key === key)?.qty || 0
  return inCartQty < Number(f.stockQty)
}
function addFood (f) {
  if (!canAddFood(f)) return alert('No more stock available.')
  cart.addFood(f, 1)
  cartOpen.value = true
  notify(`Added: ${f.name}`)
}
function addPackage (p) {
  cart.addPackage(p, 1)
  cartOpen.value = true
  notify(`Added package: ${p.name}`)
}

/* ---------- place order ---------- */
function toIsoFromLocal (dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const [hh, mm]  = timeStr.split(':').map(Number)
  const dt = new Date(y, (m - 1), d, hh, mm, 0, 0) // local time
  return dt.toISOString()
}
async function placeOrder () {
  const chk = cart.validateBeforeSubmit()
  if (!chk.ok) {
    const msg = {
      empty: 'Your cart is empty.',
      individual_requires_food_only: 'Individual order can only contain foods.',
      workshop_requires_packages_only: 'Workshop order can only contain packages.',
      individual_needs_food: 'Please add at least one food.',
      workshop_needs_package: 'Please add at least one package.',
      schedule_required: 'Please choose a date and time.',
      receive_place_required: 'Please choose where to receive the order.'
    }[chk.reason] || 'Invalid order.'
    return alert(msg)
  }
  const scheduledFor = toIsoFromLocal(cart.scheduledDate, cart.scheduledTime)
  const type = String(cart.orderType || 'INDIVIDUAL').toUpperCase()

  const payload = {
    type,
    notes: cart.notes || '',
    scheduledFor,
    receivePlace: cart.receivePlace || '',
    items: cart.items
      .map(i => {
        const base = { kind: i.kind, qty: Math.max(1, parseInt(i.qty, 10) || 1) }
        if (i.kind === 'FOOD') {
          base.foodId = i.id
          base.ingredients = (i.ingredients || []).map(x => ({
            ingredientId: x.ingredientId, included: !!x.included, value: x.value ?? null
          }))
          base.groups = (i.groups || []).map(g => ({ groupId: g.groupId, choice: g.choice ?? null }))
        } else if (i.kind === 'PACKAGE') {
          base.packageId = i.id
        }
        return base
      })
      .filter(x => (x.kind === 'FOOD' && x.foodId) || (x.kind === 'PACKAGE' && x.packageId))
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

/* ---------- dynamic grouping (no hard-coding) ---------- */
/* Text search for foods (client-side) */
const filteredFoods = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return foods.value
  return foods.value.filter(f => {
    const name = (f.name || '').toLowerCase()
    const catName =
      typeof f.categoryId === 'object' && f.categoryId
        ? String(f.categoryId.name || '').toLowerCase()
        : ''
    const desc = (f.description || '').toLowerCase()
    const tags = (f.tags || []).join(' ').toLowerCase()
    return name.includes(term) || catName.includes(term) || desc.includes(term) || tags.includes(term)
  })
})

/* Packages search */
const filteredPackages = computed(() => {
  const term = q.value.trim().toLowerCase()
  if (!term) return packages.value
  return packages.value.filter(p => {
    const name = (p.name || '').toLowerCase()
    const desc = (p.description || '').toLowerCase()
    const tags = (p.tags || []).join(' ').toLowerCase()
    return name.includes(term) || desc.includes(term) || tags.includes(term)
  })
})

/* Group foods by category id — supports categoryId as object or string */
const foodsByCat = computed(() => {
  const map = new Map()
  for (const c of categories.value) map.set(String(c._id), [])
  for (const f of filteredFoods.value) {
    const cid =
      typeof f.categoryId === 'object' && f.categoryId
        ? String(f.categoryId._id || f.categoryId.id || '')
        : String(f.categoryId || '')
    if (cid && map.has(cid)) map.get(cid).push(f)
  }
  return map
})

/* Sort categories (purely dynamic): by `order` if present, else by `name` */
const orderedCategories = computed(() => {
  return [...categories.value].sort((a, b) => {
    const ao = a.order ?? 9999, bo = b.order ?? 9999
    return ao - bo || String(a.name || '').localeCompare(String(b.name || ''))
  })
})

/* Helper for template */
const foodsOf = (cid) => foodsByCat.value.get(String(cid)) || []

/* ---------- reactive server sync on q ---------- */
let qTimer
watch(q, () => {
  clearTimeout(qTimer)
  qTimer = setTimeout(() => {
    // keep backend search/stock fresh while typing
    loadFoods()
    loadPkgs()
  }, 300)
})

/* ---------- init ---------- */
onMounted(async () => {
  // optional deep-link: ?cat=<id> → scroll into view after first render
  const initialCat = route.query.cat ? String(route.query.cat) : null
  await refresh()
  if (initialCat) {
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-cat="${initialCat}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
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
        <v-col cols="12" md="6">
          <v-text-field
            v-model="q"
            label="Search foods or packages"
            density="compact"
            variant="outlined"
            prepend-inner-icon="mdi-magnify"
            clearable
          />
        </v-col>
        <v-col cols="12" md="2">
          <v-btn :loading="loading" block @click="refresh" style="background-color: orange;">
            <v-icon start>mdi-refresh</v-icon> Refresh
          </v-btn>
        </v-col>
      </v-row>

      <!-- Tabs: All categories (rows) before Packages -->
      <v-tabs v-model="tab" class="mb-4">
        <v-tab value="all">All</v-tab>
        <v-tab value="packages">Packages</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <!-- ALL: one row per dynamic category -->
        <v-window-item value="all">
          <div class="category-list">
            <div
              v-for="c in orderedCategories"
              :key="c._id"
              class="category-row"
              :data-cat="c._id"
            >
              <div class="category-header">
                <v-icon color="primary" class="mr-1">mdi-tag</v-icon>
                <strong>{{ c.name }}</strong>
              </div>

              <div class="h-scroll">
                <template v-if="foodsOf(c._id).length">
                  <div
                    v-for="f in foodsOf(c._id)"
                    :key="f._id"
                    class="food-card"
                  >
                    <v-card class="rounded-xl">
                      <v-img :src="f.imageUrl || 'https://via.placeholder.com/600x400?text=Food'" height="180" cover />
                      <v-card-title class="text-subtitle-2">{{ f.name }}</v-card-title>
                      <v-card-text class="py-1">
                        <div class="text-caption text-medium-emphasis mb-2">
                          {{ f.description || ' ' }}
                        </div>
                        <div class="d-flex align-center justify-space-between">
                          <v-chip size="x-small" color="green" variant="tonal" v-if="f.stockQty === null">Unlimited</v-chip>
                          <v-chip size="x-small" color="orange" variant="tonal" v-else>Stock: {{ f.stockQty }}</v-chip>
                          <div class="text-caption">{{ (f.tags || []).slice(0,3).join(', ') || ' ' }}</div>
                        </div>
                      </v-card-text>
                      <v-card-actions>
                        <v-spacer />
                        <v-btn color="primary" size="small" :disabled="!canAddFood(f)" @click.stop="addFood(f)">
                          <v-icon start>mdi-cart-plus</v-icon> Add
                        </v-btn>
                      </v-card-actions>
                    </v-card>
                  </div>
                </template>

                <!-- even if empty, keep the row visible for new categories -->
                <div v-else class="empty-pill">No items yet</div>
              </div>
            </div>

            <div v-if="!loading && !categories.length" class="text-center text-medium-emphasis py-8">
              <v-icon size="36" class="mb-2">mdi-tag-off-outline</v-icon>
              <div>No categories found.</div>
            </div>
          </div>
        </v-window-item>

        <!-- PACKAGES -->
        <v-window-item value="packages">
          <v-row>
            <v-col
              v-for="p in filteredPackages"
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

            <v-col v-if="!loading && !filteredPackages.length" cols="12">
              <div class="text-center text-medium-emphasis py-8">
                <v-icon size="36" class="mb-2">mdi-package-variant-closed-remove</v-icon>
                <div>No packages found.</div>
              </div>
            </v-col>
          </v-row>
        </v-window-item>
      </v-window>
    </div>

    <!-- Cart drawer -->
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

/* Vertical list of category rows */
.category-list { display: flex; flex-direction: column; gap: 18px; }

/* Row header */
.category-header { display: flex; align-items: center; padding: 4px 4px 8px 4px; font-size: 16px; }

/* Horizontal scroller of food cards */
.h-scroll { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px; -webkit-overflow-scrolling: touch; }

/* Card width in the strip */
.food-card { flex: 0 0 240px; }

.empty-pill {
  display: inline-flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px dashed rgba(0,0,0,0.3);
  font-size: 12px;
  white-space: nowrap;
  margin: 6px 0;
}

@media (max-width: 600px) {
  .category-header { font-size: 14px; }
  .food-card { flex-basis: 200px; }
}
</style>
