<!-- src/views/customer/CustomerHistory.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows     = ref([])

const viewOpen = ref(false)
const current  = ref(null)

function fmtDateTime (v) {
  if (!v) return '—'
  try {
    const d = new Date(v)
    return new Intl.DateTimeFormat(undefined, {
      year:'numeric', month:'short', day:'2-digit',
      hour:'2-digit', minute:'2-digit'
    }).format(d)
  } catch { return String(v) }
}

function openView (o) {
  current.value = o
  viewOpen.value = true
}

async function fetchOrders () {
  loading.value = true
  try {
    const { data } = await api.get('/orders?scope=CUSTOMER')
    rows.value = Array.isArray(data) ? data : []
  } finally { loading.value = false }
}

const ph = 'https://via.placeholder.com/80x80?text=IMG'
onMounted(fetchOrders)
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" class="rounded-t-2xl" density="comfortable">
      <v-toolbar-title>My Orders</v-toolbar-title>
      <v-spacer />
      <v-btn color="white" variant="flat" :loading="loading" @click="fetchOrders">
        <v-icon start>mdi-refresh</v-icon> Refresh
      </v-btn>
    </v-toolbar>

    <div class="pa-4">
      <v-table class="rounded-xl elevation-1" density="comfortable">
        <thead>
          <tr>
            <th style="width:160px">Placed</th>
            <th>Status</th>
            <th>Type</th>
            <th>Items</th>
            <th style="width:180px">Pre-Order</th>
            <th style="width:120px" class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="o in rows" :key="o._id">
            <td>{{ fmtDateTime(o.createdAt) }}</td>
            <td>
              <v-chip size="small" :color="{
                PLACED:'grey', ACCEPTED:'blue', COOKING:'orange',
                READY:'green', DELIVERED:'teal', CANCELED:'red'
              }[o.status]" variant="tonal">
                {{ o.status }}
              </v-chip>
            </td>
            <td>{{ o.type }}</td>
            <td>
              <!-- quick inline preview with tiny avatars -->
              <div class="d-flex flex-wrap ga-2">
                <div
                  v-for="(it, idx) in o.items"
                  :key="idx"
                  class="d-flex align-center ga-2"
                >
                  <v-avatar size="28" rounded="lg">
                    <v-img :src="it.imageUrl || ph" cover />
                  </v-avatar>
                  <span class="text-caption">
                    <strong>{{ it.name }}</strong> ×{{ it.qty }}
                  </span>
                </div>
              </div>
            </td>
            <td>
              <div v-if="o.scheduledFor || o.receivePlace">
                <v-chip size="x-small" color="purple" variant="tonal" class="mr-1" v-if="o.scheduledFor">
                  {{ fmtDateTime(o.scheduledFor) }}
                </v-chip>
                <v-chip size="x-small" color="indigo" variant="tonal" v-if="o.receivePlace">
                  {{ o.receivePlace }}
                </v-chip>
              </div>
              <span v-else class="text-medium-emphasis">—</span>
            </td>
            <td class="text-right">
              <v-btn size="small" variant="tonal" color="primary" @click="openView(o)">
                <v-icon start>mdi-eye</v-icon> View
              </v-btn>
            </td>
          </tr>
          <tr v-if="rows.length===0">
            <td colspan="6" class="text-center text-medium-emphasis py-6">
              No orders yet.
            </td>
          </tr>
        </tbody>
      </v-table>
    </div>
  </v-card>

  <!-- View dialog -->
  <v-dialog v-model="viewOpen" max-width="980">
    <v-card>
      <v-card-title class="d-flex align-center">
        <div class="mr-3">Order Details</div>
        <v-chip size="small" variant="tonal" :color="{
          PLACED:'grey', ACCEPTED:'blue', COOKING:'orange',
          READY:'green', DELIVERED:'teal', CANCELED:'red'
        }[current?.status]">
          {{ current?.status }}
        </v-chip>
        <v-spacer />
        <span class="text-caption text-medium-emphasis">ID: {{ current?._id }}</span>
      </v-card-title>

      <v-card-text>
        <!-- Meta -->
        <v-row dense class="mb-3">
          <v-col cols="12" md="6">
            <v-sheet class="pa-3 rounded-lg elevation-0 bg-grey-lighten-4">
              <div class="text-subtitle-2 mb-1">Placed</div>
              <div>{{ fmtDateTime(current?.createdAt) }}</div>
              <div class="text-caption text-medium-emphasis">
                Updated {{ fmtDateTime(current?.updatedAt) }}
              </div>
            </v-sheet>
          </v-col>
          <v-col cols="12" md="6">
            <v-sheet class="pa-3 rounded-lg elevation-0 bg-grey-lighten-4">
              <div class="text-subtitle-2 mb-1">Pre-Order</div>
              <div><strong>Time:</strong> {{ fmtDateTime(current?.scheduledFor) }}</div>
              <div><strong>Place:</strong> {{ current?.receivePlace || '—' }}</div>
            </v-sheet>
          </v-col>
        </v-row>

        <!-- Notes -->
        <div class="mb-4" v-if="current?.notes">
          <div class="text-subtitle-2 mb-1">Notes</div>
          <v-alert type="info" variant="tonal" density="comfortable">
            {{ current.notes }}
          </v-alert>
        </div>

        <!-- Items with images -->
        <div class="text-subtitle-2 mb-2">Items</div>
        <v-table density="comfortable" class="rounded-lg">
          <thead>
            <tr>
              <th style="width:84px">Image</th>
              <th style="width:28%">Item</th>
              <th style="width:10%">Qty</th>
              <th>Ingredients</th>
              <th>Choices</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(it,idx) in (current?.items||[])" :key="idx">
              <td>
                <v-img
                  :src="it.imageUrl || ph"
                  height="64"
                  width="84"
                  class="rounded-lg"
                  cover
                />
              </td>
              <td>
                <div class="font-weight-medium">
                  {{ it.name }}
                  <span v-if="it.kind==='PACKAGE'" class="text-caption text-medium-emphasis">(package)</span>
                </div>
              </td>
              <td>×{{ it.qty }}</td>

              <!-- Ingredients -->
              <td>
                <div v-if="(it.ingredients||[]).length">
                  <v-chip
                    v-for="(ing, k) in it.ingredients"
                    :key="k"
                    size="x-small"
                    :color="ing.included ? 'green' : 'red'"
                    variant="tonal"
                    class="mr-1 mb-1"
                  >
                    {{ ing.name || 'Ingredient' }}
                    <template v-if="ing.value !== null">: {{ ing.value }}</template>
                    <template v-else> ({{ ing.included ? 'included' : 'removed' }})</template>
                  </v-chip>
                </div>
                <span v-else class="text-medium-emphasis">—</span>
              </td>

              <!-- Groups -->
              <td>
                <div v-if="(it.groups||[]).length">
                  <v-chip
                    v-for="(g, k) in it.groups"
                    :key="k"
                    size="x-small"
                    color="indigo"
                    variant="tonal"
                    class="mr-1 mb-1"
                  >
                    {{g.choiceLabel }} : {{g.choice || 'Choice' }}
                  </v-chip>
                </div>
                <span v-else class="text-medium-emphasis">—</span>
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Timeline -->
        <div class="mt-4">
          <div class="text-subtitle-2 mb-2">Timeline</div>
          <v-row dense>
            <v-col cols="12" sm="6" md="4">
              <div><strong>Accepted:</strong> {{ fmtDateTime(current?.acceptedAt) }}</div>
              <div><strong>Cooking:</strong> {{ fmtDateTime(current?.cookingAt) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div><strong>Ready:</strong> {{ fmtDateTime(current?.readyAt) }}</div>
              <div><strong>Delivered:</strong> {{ fmtDateTime(current?.deliveredAt) }}</div>
            </v-col>
            <v-col cols="12" sm="6" md="4">
              <div><strong>Canceled:</strong> {{ fmtDateTime(current?.canceledAt) }}</div>
              <div class="text-caption text-medium-emphasis mt-1">
                Stock committed: {{ current?.stockCommitted ? 'Yes' : 'No' }}
              </div>
            </v-col>
          </v-row>
        </div>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="viewOpen=false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
