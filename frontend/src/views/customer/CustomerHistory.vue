<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth } from '@/store/auth'
import api from '@/utils/api'
import socket from '@/utils/socket'

const auth = useAuth()

/* ───────────────── state ───────────────── */
const loading  = ref(false)
const rows     = ref([])

const detailsOpen = ref(false)
const selected    = ref(null)
const hydrating   = ref(false)
const foodDefs    = new Map() // foodId -> /foods/:id payload

/* ───────────────── table ───────────────── */
const headers = [
  { title: 'Time',   key: 'createdAt', sortable: true, width: 180 },
  { title: 'Type',   key: 'type', width: 120 },
  { title: 'Items',  key: 'items' },
  { title: 'Status', key: 'status', align: 'center', width: 130 },
  { title: 'Actions', key: 'actions', align: 'end', width: 180 },
]

function prettyTime (d) {
  try { return new Date(d).toLocaleString() } catch { return '' }
}
function statusColor (s) {
  return ({
    PLACED:'grey',
    ACCEPTED:'primary',
    COOKING:'deep-purple',
    READY:'orange',
    DELIVERED:'green',
    CANCELED:'red'
  }[s] || 'grey')
}

/* ───────────────── api ───────────────── */
async function load () {
  loading.value = true
  try {
    const { data } = await api.get('/orders', { params: { scope: 'CUSTOMER' } })
    rows.value = (data || []).map(normalizeOrderRow)

    // auto-join active orders
    rows.value.forEach(o => {
      if (['PLACED','ACCEPTED','COOKING','READY'].includes(o.status)) {
        socket.emit('join-order', { orderId: o._id })
      }
    })
  } finally {
    loading.value = false
  }
}

function normalizeOrderRow (o) {
  const t = {}
  if (o.acceptedAt)  t.Accepted  = o.acceptedAt
  if (o.cookingAt)   t.Cooking   = o.cookingAt
  if (o.readyAt)     t.Ready     = o.readyAt
  if (o.deliveredAt) t.Delivered = o.deliveredAt
  if (o.canceledAt)  t.Canceled  = o.canceledAt
  return { ...o, timestamps: t }
}

function upsert (o) {
  const row = normalizeOrderRow(o)
  const i = rows.value.findIndex(x => x._id === row._id)
  if (i === -1) rows.value.unshift(row)
  else rows.value[i] = row

  if (selected.value?._id === row._id) {
    selected.value = row
    hydrateSelected().catch(() => {})
  }
}

async function markReceived (o) {
  try {
    const { data } = await api.patch(`/orders/${o._id}/deliver`)
    upsert(data)
  } catch (e) {
    console.error(e)
    alert(e?.response?.data?.message || 'Failed to mark as received')
  }
}

/* ───────────────── dialog + hydration ───────────────── */
function openDetails (order) {
  selected.value = order
  detailsOpen.value = true
  hydrateSelected().catch(() => {})
}
function closeDetails () {
  detailsOpen.value = false
  selected.value = null
}

async function fetchFoodDef (foodId) {
  if (!foodId) return null
  if (foodDefs.has(foodId)) return foodDefs.get(foodId)
  const { data } = await api.get(`/foods/${foodId}`)
  foodDefs.set(String(foodId), data)
  return data
}

/**
 * Build readable strings from the order's saved mods (exactly what customer picked).
 * Uses food defs only to resolve human labels.
 */
function decorateItemForDisplay (it, def) {
  const mods = Array.isArray(it.mods) ? it.mods : []

  // label lookups from defs (if available)
  const ingNameById   = new Map()
  const grpNameById   = new Map()
  const grpChoicesById= new Map()

  if (def) {
    for (const a of (def.ingredients || [])) {
      const iid = String(a.ingredientId?._id || a.ingredientId)
      ingNameById.set(iid, a.ingredientId?.name || a.ingredientId?.label || 'Ingredient')
    }
    for (const g of (def.choiceGroups || [])) {
      const gid = String(g.groupId?._id || g.groupId)
      grpNameById.set(gid, g.groupId?.name || g.name || 'Choice')
      const choices = g.groupId?.choices || g.choices || []
      grpChoicesById.set(gid, new Map(
        choices.map(c => [String(c.value), c.label || c.name || String(c.value)])
      ))
    }
  }

  const ingredientsDisplay = []
  const choicesDisplay = []

  for (const m of mods) {
    const kind = String(m.kind || '').toUpperCase()

    if (kind === 'INGREDIENT') {
      const iid  = String(m.ingredientId || '')
      const name = m.label || ingNameById.get(iid) || 'Ingredient'
      const typ  = String(m.type || '').toUpperCase()

      if (typ === 'BOOLEAN') {
        // customer-picked true/false
        ingredientsDisplay.push(m.value ? name : `No ${name}`)
      } else if (typ === 'PERCENT') {
        const n = Number(m.value)
        if (Number.isFinite(n)) {
          const num = String(n).replace(/\.0+$/,'')
          ingredientsDisplay.push(`${name}: ${num}%`)
        }
      } else if (typ === 'CHOICE') {
        // ingredient-level choices (if you use them)
        ingredientsDisplay.push(`${name}: ${m.value}`)
      }
    }

    if (kind === 'GROUP') {
      const gid   = String(m.groupId || '')
      const gName = m.label || grpNameById.get(gid) || 'Choice'
      const mp    = grpChoicesById.get(gid) || new Map()
      const v     = (m.value != null) ? String(m.value) : ''
      const vLabel= mp.get(v) || v
      choicesDisplay.push(`${gName}: ${vLabel}`)
    }
  }

  return { ingredientsDisplay, choicesDisplay }
}

async function hydrateSelected () {
  if (!selected.value) return
  hydrating.value = true
  try {
    const ids = Array.from(new Set(
      (selected.value.items || []).map(it => it.foodId).filter(Boolean).map(String)
    ))
    await Promise.all(ids.map(id => foodDefs.has(id) ? null : fetchFoodDef(id)))

    selected.value = {
      ...selected.value,
      items: (selected.value.items || []).map(it => {
        const def = it.foodId ? foodDefs.get(String(it.foodId)) : null
        const disp = decorateItemForDisplay(it, def)
        return { ...it, _ingredientsDisplay: disp.ingredientsDisplay, _choicesDisplay: disp.choicesDisplay }
      })
    }
  } finally {
    hydrating.value = false
  }
}

/* ───────────────── sockets ───────────────── */
const onStatus = (order) => upsert(order)
const onNew    = (order) => {
  if (String(order.customerId) === String(auth.user?._id)) upsert(order)
}

onMounted(() => {
  load()
  socket.emit('join', { role: 'CUSTOMER', userId: auth.user?._id })
  socket.on('order:status', onStatus)
  socket.on('order:new', onNew)
})
onBeforeUnmount(() => {
  socket.off('order:status', onStatus)
  socket.off('order:new', onNew)
})
</script>

<template>
  <v-card class="rounded-2xl elevation-1">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title class="font-weight-bold">Customer</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-data-table
        :headers="headers"
        :items="rows"
        :items-per-page="10"
        class="rounded-xl"
        :loading="loading"
      >
        <template #item.createdAt="{ item }">
          <span class="text-medium-emphasis">{{ prettyTime(item.createdAt) }}</span>
        </template>

        <template #item.items="{ item }">
          <div class="d-flex flex-wrap ga-1">
            <v-chip
              v-for="it in item.items"
              :key="(it.foodId||it.packageId)+'-'+it.qty"
              size="small"
              color="primary"
              variant="tonal"
            >
              {{ it.qty }}× {{ it.name || 'Item' }}
            </v-chip>
          </div>
        </template>

        <template #item.status="{ item }">
          <v-chip :color="statusColor(item.status)" label>{{ item.status }}</v-chip>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn color="secondary" size="small" variant="tonal" @click="openDetails(item)">
              <v-icon start>mdi-eye</v-icon> View
            </v-btn>
            <v-btn
              v-if="item.status === 'READY'"
              color="green"
              size="small"
              variant="elevated"
              @click="markReceived(item)"
            >
              <v-icon start>mdi-check</v-icon> Received
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>
  </v-card>

  <!-- Order Details -->
  <v-dialog v-model="detailsOpen" max-width="820">
    <v-card class="rounded-2xl" :loading="hydrating">
      <v-toolbar flat>
        <v-toolbar-title class="font-weight-bold">
          Order #{{ selected?._id?.slice(-6) }}
          <span class="text-medium-emphasis">• {{ selected?.type }}</span>
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="closeDetails"><v-icon>mdi-close</v-icon></v-btn>
      </v-toolbar>

      <v-divider />

      <v-card-text>
        <div class="d-flex flex-wrap ga-6">
          <div><strong>Placed:</strong> {{ prettyTime(selected?.createdAt) }}</div>
          <div>
            <strong>Status:</strong>
            <v-chip :color="statusColor(selected?.status)" size="small" label>
              {{ selected?.status }}
            </v-chip>
          </div>
        </div>

        <v-divider class="my-4" />

        <strong>Items</strong>
        <v-table density="comfortable" class="rounded-lg mt-2">
          <thead>
            <tr>
              <th style="width:34%">Item</th>
              <th style="width:52%">Customizations</th>
              <th class="text-right" style="width:14%">Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="it in (selected?.items || [])"
              :key="(it.foodId||it.packageId)+'-'+it.qty"
            >
              <td class="font-weight-medium">
                <div class="d-flex align-center ga-3">
                  <v-avatar size="36" rounded="lg" v-if="it.imageUrl">
                    <v-img :src="it.imageUrl" :alt="it.name" cover />
                  </v-avatar>
                  <div>{{ it.name || 'Item' }}</div>
                </div>
              </td>

              <td class="text-caption text-medium-emphasis">
                <div v-if="(it._ingredientsDisplay?.length)">
                  <em class="mr-1">Ingredients:</em>
                  {{ it._ingredientsDisplay.join(', ') }}
                </div>

                <div v-if="(it._choicesDisplay?.length)">
                  <em class="mr-1">Choices:</em>
                  {{ it._choicesDisplay.join(', ') }}
                </div>

                <div v-if="!(it._ingredientsDisplay?.length) && !(it._choicesDisplay?.length)">
                  —
                </div>
              </td>

              <td class="text-right">{{ it.qty }}</td>
            </tr>

            <tr v-if="(selected?.items || []).length === 0">
              <td colspan="3" class="text-center text-medium-emphasis">No items</td>
            </tr>
          </tbody>
        </v-table>

        <div class="mt-3" v-if="selected?.notes">
          <strong>Notes</strong>
          <div class="text-medium-emphasis">{{ selected.notes }}</div>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          v-if="selected?.status === 'READY'"
          color="green"
          @click="markReceived(selected)"
        >
          <v-icon start>mdi-check</v-icon> Mark Received
        </v-btn>
        <v-btn variant="text" @click="closeDetails">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
/* Soft, friendly vibe */
.v-data-table { --v-theme-surface-variant: rgba(0,0,0,.02); }
</style>
