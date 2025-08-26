<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import api from '@/utils/api'
import socket from '@/utils/socket'

const ORDER_KEY = 'current_order_id'

const cats = ref([]); const foods = ref([])
const loading = ref(false); const placing = ref(false)

const cart = ref([]) // [{ _id,name,qty,preferences }]
const currentOrder = ref(null)

const statusText = {
  PENDING:'Pending — waiting for chef',
  ACCEPTED:'Accepted — please wait',
  COOKING:'Cooking',
  READY:'Ready — please pick up',
  DELIVERED:'Delivered — enjoy!'
}
const tasteOptions = ['chilli','tasty','sweet','sour','salty','no onion']

const grouped = computed(() => {
  const by = {}; cats.value.forEach(c => by[c._id] = { cat:c, foods:[] })
  foods.value.forEach(f => by[f.categoryId?._id || f.categoryId]?.foods.push(f))
  return Object.values(by).filter(g => g.foods.length)
})

const load = async () => {
  loading.value = true
  try {
    const [c,f] = await Promise.all([
      api.get('/categories',{ params:{ activeOnly:true }}),
      api.get('/foods',{ params:{ activeOnly:true }})
    ])
    cats.value = c.data; foods.value = f.data
  } finally { loading.value = false }
}
const stepIndex = (s) => ({ PENDING:1, ACCEPTED:2, COOKING:3, READY:4, DELIVERED:5 }[s] || 1)


function addToCart(food){
  const i = cart.value.findIndex(x=>x._id===food._id)
  if(i>=0) cart.value[i].qty++
  else cart.value.push({ _id:food._id, name:food.name, qty:1, preferences:{} })
}
function changePref(item, key){ item.preferences[key] = !item.preferences[key] }

async function placeOrder(){
  if(!cart.value.length) return
  placing.value = true
  try{
    const items = cart.value.map(it=>({ foodId:it._id, qty:it.qty, preferences:it.preferences }))
    const { data } = await api.post('/orders',{ items })
    currentOrder.value = data
    localStorage.setItem(ORDER_KEY, data._id)
    cart.value = []
    socket.emit('join-order', { orderId: data._id })
  } finally { placing.value = false }
}

async function refreshSavedOrder(){
  const id = localStorage.getItem(ORDER_KEY); if(!id) return
  try{
    const { data } = await api.get(`/orders/${id}`)
    currentOrder.value = data
    socket.emit('join-order', { orderId: id })
  }catch{
    localStorage.removeItem(ORDER_KEY)
    currentOrder.value = null
  }
}

async function markDelivered(){
  if(!currentOrder.value) return
  await api.patch(`/orders/${currentOrder.value._id}/deliver`)
}

function onOrderUpdate(p){
  const id = currentOrder.value?._id || localStorage.getItem(ORDER_KEY)
  if(!id || p.orderId !== id) return
  if(!currentOrder.value) currentOrder.value = { _id:id, status:p.status }
  else currentOrder.value.status = p.status
  if(['DELIVERED','CANCELED'].includes(p.status)) localStorage.removeItem(ORDER_KEY)
}

onMounted(async ()=>{ await load(); await refreshSavedOrder(); socket.on('orders:update', onOrderUpdate) })
onBeforeUnmount(()=> socket.off('orders:update', onOrderUpdate))
</script>

<template>
  <div>
    <h2>Menu</h2>
    <v-progress-linear v-if="loading" indeterminate class="mb-3" />
    <div v-for="g in grouped" :key="g.cat._id" class="mb-6">
      <h3 class="mb-2">{{ g.cat.name }}</h3>
      <v-row dense>
        <v-col cols="12" sm="6" md="4" v-for="f in g.foods" :key="f._id">
          <v-card>
            <v-img v-if="f.imageUrl" :src="f.imageUrl" height="140" cover />
            <v-card-title>{{ f.name }}</v-card-title>
            <v-card-subtitle v-if="f.description">{{ f.description }}</v-card-subtitle>
            <v-card-actions>
              <v-btn color="primary" @click="addToCart(f)">Add</v-btn>
              <v-spacer />
              <v-chip v-if="f.stockRemaining === 0" color="error" size="small" variant="tonal">Out of stock</v-chip>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </div>

    <v-divider class="my-6" />

    <h2>My Cart</h2>
    <div v-if="!cart.length" class="text-medium-emphasis">No items yet.</div>
    <v-table v-else>
      <thead><tr><th>Item</th><th>Qty</th><th>Preferences</th></tr></thead>
      <tbody>
        <tr v-for="it in cart" :key="it._id">
          <td>{{ it.name }}</td>
          <td>
            <v-btn size="x-small" @click="it.qty=Math.max(1,it.qty-1)">-</v-btn>
            <span class="mx-2">{{ it.qty }}</span>
            <v-btn size="x-small" @click="it.qty++">+</v-btn>
          </td>
          <td>
            <v-chip v-for="t in tasteOptions" :key="t" class="mr-1 mb-1" size="x-small"
              :color="it.preferences[t] ? 'primary': undefined" variant="tonal"
              @click="changePref(it,t)">{{ t }}</v-chip>
          </td>
        </tr>
      </tbody>
    </v-table>
    <v-btn class="mt-3" color="primary" :loading="placing" :disabled="!cart.length" @click="placeOrder">
      Place Order
    </v-btn>

    <v-divider class="my-6" />

    <!-- Order Status -->
    <h2>Order Status</h2>
    <div v-if="!currentOrder" class="text-medium-emphasis">No active order.</div>

    <div v-else>
    <v-alert :type="currentOrder.status==='READY' ? 'success':'info'" variant="tonal" class="mb-4">
        <div><b>#{{ currentOrder._id?.slice(-6) }}</b></div>
        <div class="text-medium-emphasis">
        {{ statusText[currentOrder.status] || currentOrder.status }}
        </div>
    </v-alert>

    <!-- Stepper -->
    <v-stepper :model-value="stepIndex(currentOrder.status)" alt-labels flat>
        <v-stepper-header>
        <v-stepper-item value="1" title="Pending" />
        <v-divider />
        <v-stepper-item value="2" title="Accepted" />
        <v-divider />
        <v-stepper-item value="3" title="Cooking" />
        <v-divider />
        <v-stepper-item value="4" title="Ready" />
        <v-divider />
        <v-stepper-item value="5" title="Delivered" />
        </v-stepper-header>
    </v-stepper>

    <div class="mt-2">
        <v-btn
        v-if="currentOrder.status==='READY'"
        size="small" color="success" @click="markDelivered">
        I got it
        </v-btn>
    </div>
    </div>

  </div>
</template>
