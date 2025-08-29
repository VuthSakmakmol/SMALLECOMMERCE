<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useCart } from '@/store/cart'
import api from '@/utils/api'

const router = useRouter()
const route = useRoute()
const cart = useCart()

const loading = ref(false)
const categories = ref([])
const foods = ref([])
const packages = ref([])

const q = ref('')
const cat = ref('ALL')
const tab = ref('foods')

const cartOpen = ref(false)
const snack = ref({ show:false, text:'' })
const notify = t => snack.value = { show:true, text:t }

const categoryOptions = computed(() => [
  { title: 'All Categories', value: 'ALL' },
  ...categories.value.map(c => ({ title: c.name, value: c._id }))
])

async function loadCats(){ const {data}=await api.get('/categories?activeOnly=true'); categories.value=data }
async function loadFoods(){
  const p=new URLSearchParams({ activeOnly:'true' })
  if(q.value) p.set('q',q.value)
  if(cat.value!=='ALL') p.set('categoryId',cat.value)
  const {data}=await api.get(`/foods?${p.toString()}`); foods.value=data
}
async function loadPkgs(){
  const p=new URLSearchParams({ activeOnly:'true' })
  if(q.value) p.set('q',q.value)
  const {data}=await api.get(`/packages?${p.toString()}`); packages.value=data
}
async function refresh(){ loading.value=true; try { await Promise.all([loadCats(),loadFoods(),loadPkgs()]) } finally { loading.value=false } }

function canAddFood(f){
  if (f.dailyLimit === null) return true
  const key = `FOOD:${f._id}`
  const inCart = cart.items.find(i => i.key===key)?.qty || 0
  const remaining = Number(f.stockRemaining ?? f.dailyLimit ?? 0)
  return inCart < remaining
}

function addFood(f){ if(!canAddFood(f)) return alert('No more stock for today.'); cart.addFood(f,1); cartOpen.value=true; notify(`Added: ${f.name}`) }
function addPackage(p){ cart.addPackage(p,1); cartOpen.value=true; notify(`Added package: ${p.name}`) }

async function placeOrder () {
  if (!cart.hasItems) return

  const type = String(cart.orderType || 'INDIVIDUAL').toUpperCase()

  const payload = {
    type,
    notes: cart.notes || '',
    items: cart.items
      .map(i => ({
        kind: i.kind,                         // 'FOOD' | 'PACKAGE'
        foodId:    i.kind === 'FOOD'    ? i.id : undefined,
        packageId: i.kind === 'PACKAGE' ? i.id : undefined,
        // 👇 normalize to a positive integer; fallback to 1
        qty: Math.max(1, parseInt(i.qty, 10) || 1)
      }))
      .filter(x =>
        (x.kind === 'FOOD' && x.foodId) ||
        (x.kind === 'PACKAGE' && x.packageId)
      )

  }

  // ✅ only add groupKey if it's a real string for GROUP
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


onMounted(async () => { if(route.query.cat) cat.value=String(route.query.cat); await refresh() })
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
          <v-text-field v-model="q" label="Search foods or packages" prepend-inner-icon="mdi-magnify" clearable @keyup.enter="refresh"/>
        </v-col>
        <v-col cols="12" md="4">
          <v-select :items="categoryOptions" v-model="cat" label="Category" :disabled="tab!=='foods'" @update:modelValue="loadFoods"/>
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="refresh"><v-icon start>mdi-refresh</v-icon> Refresh</v-btn>
        </v-col>
      </v-row>

      <v-tabs v-model="tab" class="mb-4">
        <v-tab value="foods">Foods</v-tab>
        <v-tab value="packages">Packages (Workshops)</v-tab>
      </v-tabs>

      <v-window v-model="tab">
        <v-window-item value="foods">
          <v-row>
            <v-col v-for="f in foods" :key="f._id" cols="12" sm="6" md="4" lg="3">
              <v-card class="h-100 rounded-xl">
                <v-img :src="f.imageUrl || 'https://via.placeholder.com/600x400?text=Food'" height="150" cover />
                <v-card-title class="text-subtitle-1">{{ f.name }}</v-card-title>
                <v-card-subtitle>{{ f.categoryId?.name || '—' }}</v-card-subtitle>
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">{{ f.description || ' ' }}</div>
                  <div class="d-flex align-center justify-space-between">
                    <v-chip size="small" color="green" variant="tonal" v-if="f.dailyLimit===null">Unlimited</v-chip>
                    <v-chip size="small" color="orange" variant="tonal" v-else>
                      {{ (f.stockRemaining ?? f.dailyLimit) }} / {{ f.dailyLimit }} today
                    </v-chip>
                    <div class="text-caption">Tags: {{ (f.tags || []).join(', ') || '—' }}</div>
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

        <v-window-item value="packages">
          <v-row>
            <v-col v-for="p in packages" :key="p._id" cols="12" sm="6" md="4" lg="3">
              <v-card class="h-100 rounded-xl">
                <v-img :src="p.imageUrl || 'https://via.placeholder.com/600x400?text=Package'" height="150" cover />
                <v-card-title class="text-subtitle-1">{{ p.name }}</v-card-title>
                <v-card-text>
                  <div class="text-caption text-medium-emphasis mb-2">{{ p.description || ' ' }}</div>
                  <div class="d-flex flex-wrap ga-1">
                    <v-chip v-for="it in p.items" :key="it.foodId" size="x-small" variant="outlined">×{{ it.qty }}</v-chip>
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

    <!-- Drawer -->
    <v-navigation-drawer v-model="cartOpen" location="right" temporary width="420">
      <v-toolbar flat>
        <v-toolbar-title>Cart ({{ cart.count }})</v-toolbar-title>
        <v-spacer/><v-btn icon @click="cartOpen=false"><v-icon>mdi-close</v-icon></v-btn>
      </v-toolbar>

      <div class="pa-3">
        <v-list density="comfortable">
          <v-list-item v-for="it in cart.items" :key="it.key">
            <template #prepend>
              <v-chip size="x-small" class="mr-2" :color="it.kind==='PACKAGE' ? 'purple' : 'primary'">{{ it.kind }}</v-chip>
            </template>
            <v-list-item-title>{{ it.name }}</v-list-item-title>
            <template #append>
              <div class="d-flex align-center ga-2">
                <v-btn icon size="x-small" variant="tonal" @click="cart.dec(it)"><v-icon>mdi-minus</v-icon></v-btn>
                <div class="text-subtitle-2" style="min-width:24px;text-align:center">{{ it.qty }}</div>
                <v-btn icon size="x-small" variant="tonal" @click="cart.inc(it)"><v-icon>mdi-plus</v-icon></v-btn>
                <v-btn icon size="x-small" variant="text" color="red" @click="cart.remove(it)"><v-icon>mdi-delete</v-icon></v-btn>
              </div>
            </template>
          </v-list-item>
          <v-list-item v-if="!cart.items.length"><v-list-item-title class="text-medium-emphasis">Your cart is empty.</v-list-item-title></v-list-item>
        </v-list>

        <v-divider class="my-3"/>

        <v-select :items="[
          { title:'Individual', value:'INDIVIDUAL' },
          { title:'Group', value:'GROUP' },
          { title:'Workshop', value:'WORKSHOP' }
        ]" v-model="cart.orderType" label="Order type"/>

        <v-text-field v-if="cart.orderType==='GROUP'" v-model="cart.groupKey" label="Group code (optional)" density="comfortable"/>
        <v-textarea v-model="cart.notes" rows="2" label="Notes (optional)"/>

        <div class="d-flex justify-end mt-2">
          <v-btn color="primary" :disabled="!cart.hasItems" @click="placeOrder">
            <v-icon start>mdi-check</v-icon> Place order
          </v-btn>
        </div>
      </div>
    </v-navigation-drawer>

    <v-btn class="cart-fab" size="large" color="primary" icon @click="cartOpen = true">
      <v-badge :content="cart.count" :model-value="cart.count>0" overlap>
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
