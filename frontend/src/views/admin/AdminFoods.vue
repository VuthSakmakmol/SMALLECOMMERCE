<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'

// DEBUG logger
const DEBUG = true
const dlog = (...args) => { if (DEBUG) console.log('[Foods]', ...args) }
const dtable = (arr, label='table') => { if (DEBUG && Array.isArray(arr)) console.table(arr, ['ingredientId','defaultIncluded','removable','defaultValue']) }


const loading = ref(false)
const rows = ref([])
const categories = ref([])
const libIngredients = ref([])   // library
const libGroups = ref([])

const q = ref('')
const catFilter = ref('ALL')

const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)
const tab = ref('basic')

const form = ref({
  name: '',
  categoryId: '',
  imageUrl: '',
  description: '',
  tags: [],
  unlimited: true,
  stockQty: 0,
  // attachments
  attachIngredients: [], // [{ ingredientId, defaultIncluded?, removable?, defaultValue? }]
  attachGroups: []       // [{ groupId, defaultChoice? }]
})

const headers = [
  { title: 'Image', key: 'image', width: 72 },
  { title: 'Name', key: 'name' },
  { title: 'Category', key: 'category' },
  { title: 'Avail', key: 'avail', align: 'center', width: 220 },
  { title: 'Stock', key: 'stock', align: 'center', width: 120 },
  { title: 'Build', key: 'build', width: 160 },
  { title: 'Updated', key: 'updatedAt', width: 200 },
  { title: 'Actions', key: 'actions', align: 'end', width: 190 }
]

const rules = { required: v => !!String(v || '').trim() || 'Required' }

const categoryOptions = computed(() =>
  categories.value.map(c => ({ title: c.name, value: c._id }))
)

const ingredientOpts = computed(() =>
  libIngredients.value.map(i => ({ title: `${i.name} (${i.type})`, value: i._id, raw: i }))
)
const groupOpts = computed(() =>
  libGroups.value.map(g => ({ title: g.name, value: g._id, raw: g }))
)

/* ---------- load ---------- */
async function loadCategories () {
  const { data } = await api.get('/categories?activeOnly=true')
  categories.value = data
}
async function loadFoods () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (catFilter.value !== 'ALL') params.set('categoryId', catFilter.value)
    if (q.value) params.set('q', q.value)
    params.set('activeOnly', 'false')
    const { data } = await api.get(`/foods?${params.toString()}`)
    rows.value = data
  } finally { loading.value = false }
}
async function loadLibrary () {
  const [ings, grps] = await Promise.all([
    api.get('/ingredients'),
    api.get('/choice-groups')
  ])
  libIngredients.value = ings.data
  libGroups.value = grps.data
}

onMounted(async () => {
  await Promise.all([loadCategories(), loadLibrary(), loadFoods()])
})

/* ---------- table helpers ---------- */
function patchRow (row) {
  const i = rows.value.findIndex(r => r._id === row._id)
  if (i !== -1) rows.value[i] = row
}
async function toggleAvail (r, scope, value) {
  try {
    const { data } = await api.patch(`/foods/${r._id}/toggle`, { scope, value })
    patchRow(data)
  } catch (e) { alert(e?.response?.data?.message || 'Toggle failed') }
}
async function setStockQuick (r) {
  const v = prompt('Set stock (empty = Unlimited):', r.stockQty ?? '')
  if (v === null) return
  const stockQty = v === '' ? null : Math.max(0, parseInt(v, 10) || 0)
  try {
    const { data } = await api.patch(`/foods/${r._id}/stock`, { stockQty })
    patchRow(data)
  } catch (e) { alert(e?.response?.data?.message || 'Set stock failed') }
}
async function removeOne (r) {
  if (!confirm(`Delete "${r.name}"?`)) return
  try {
    await api.delete(`/foods/${r._id}`)
    rows.value = rows.value.filter(x => x._id !== r._id)
  } catch (e) { alert(e?.response?.data?.message || 'Delete failed') }
}

/* ---------- dialog ---------- */
function openCreate () {
  editing.value = null
  tab.value = 'basic'
  form.value = {
    name: '', categoryId: '', imageUrl: '', description: '', tags: [],
    unlimited: true, stockQty: 0,
    attachIngredients: [], attachGroups: []
  }
  dialog.value = true
}
function openEdit (r) {
  editing.value = r
  tab.value = 'basic'
  form.value = {
    name: r.name,
    categoryId: r.categoryId?._id || r.categoryId || '',
    imageUrl: r.imageUrl || '',
    description: r.description || '',
    tags: Array.isArray(r.tags) ? r.tags : [],
    unlimited: r.stockQty === null,
    stockQty: r.stockQty ?? 0,
    attachIngredients: Array.isArray(r.ingredients)
      ? r.ingredients.map(it => ({
          ingredientId: it.ingredientId?._id || it.ingredientId,
          defaultIncluded: !!it.defaultIncluded,
          removable: !!it.removable,
          defaultValue: it.defaultValue ?? null
        }))
      : [],
    attachGroups: Array.isArray(r.choiceGroups)
      ? r.choiceGroups.map(g => ({
          groupId: g.groupId?._id || g.groupId,
          defaultChoice: g.defaultChoice ?? null
        }))
      : []
  }
  dialog.value = true
}

function addIngLine () { form.value.attachIngredients.push({ ingredientId: null, defaultIncluded: true, removable: true, defaultValue: null }) }
function delIngLine (i) { form.value.attachIngredients.splice(i,1) }
function addGrpLine () { form.value.attachGroups.push({ groupId: null, defaultChoice: null }) }
function delGrpLine (i) { form.value.attachGroups.splice(i,1) }

function ingType(id) {
  const lib = libIngredients.value.find(x => x._id === id)
  return lib?.type || null
}
function ingDef(id) {
  return libIngredients.value.find(x => x._id === id) || null
}
function grpDef(id) {
  return libGroups.value.find(x => x._id === id) || null
}

async function save () {
  const ok = await formRef.value?.validate()
  if (!ok?.valid) {
    dlog('Form invalid')
    return
  }

  // base payload
  const payload = {
    name: form.value.name.trim(),
    categoryId: form.value.categoryId,
    imageUrl: form.value.imageUrl || '',
    description: form.value.description || '',
    tags: Array.isArray(form.value.tags) ? form.value.tags : [],
    stockQty: form.value.unlimited ? null : Math.max(0, parseInt(form.value.stockQty, 10) || 0),
  }

  // attachments
  const ingredients = []
  for (const it of form.value.attachIngredients || []) {
    if (!it.ingredientId) continue
    const d = ingDef(it.ingredientId); if (!d) continue
    const one = {
      ingredientId: it.ingredientId,
      defaultIncluded: !!it.defaultIncluded,
      removable: !!it.removable
    }
    if (d.type === 'PERCENT') {
      const n = Number(it.defaultValue)
      one.defaultValue = Number.isFinite(n)
        ? Math.max(d.min ?? 0, Math.min(d.max ?? 100, n))
        : (d.defaultValue ?? 100)
    } else if (d.type === 'CHOICE') {
      const allowed = (d.choices || []).map(c => c.value)
      one.defaultValue = allowed.includes(it.defaultValue)
        ? it.defaultValue
        : (d.defaultChoice ?? allowed[0] ?? null)
    }
    ingredients.push(one)
  }

  const choiceGroups = []
  for (const g of form.value.attachGroups || []) {
    if (!g.groupId) continue
    const def = grpDef(g.groupId); if (!def) continue
    const allowed = (def.choices || []).map(c => c.value)
    choiceGroups.push({
      groupId: g.groupId,
      defaultChoice: allowed.includes(g.defaultChoice)
        ? g.defaultChoice
        : (def.required ? (allowed[0] ?? null) : (g.defaultChoice ?? null))
    })
  }

  payload.ingredients = ingredients
  payload.choiceGroups = choiceGroups

  // ---- DEBUG LOGS ----
  dlog('Attempting to save food', {
    mode: editing.value ? 'UPDATE' : 'CREATE',
    payload: { ...payload, _logNote: 'ingredients & groups printed below' }
  })
  dlog('Ingredients array:')
  dtable(payload.ingredients)
  dlog('ChoiceGroups array:')
  if (DEBUG && Array.isArray(payload.choiceGroups)) console.table(payload.choiceGroups, ['groupId','defaultChoice'])

  try {
    const t0 = performance.now()
    if (editing.value) {
      const { data } = await api.put(`/foods/${editing.value._id}`, payload)
      const t1 = performance.now()
      dlog('✅ SAVE SUCCESS (UPDATE)', { ms: Math.round(t1 - t0), id: data?._id, ingredients: data?.ingredients?.length, choiceGroups: data?.choiceGroups?.length })
      patchRow(data)
    } else {
      const { data } = await api.post('/foods', payload)
      const t1 = performance.now()
      dlog('✅ SAVE SUCCESS (CREATE)', { ms: Math.round(t1 - t0), id: data?._id, ingredients: data?.ingredients?.length, choiceGroups: data?.choiceGroups?.length })
      rows.value.unshift(data)
    }
    dialog.value = false
  } catch (e) {
    const res = e?.response
    dlog('❌ SAVE FAILED', {
      status: res?.status,
      statusText: res?.statusText,
      url: res?.config?.url,
      method: res?.config?.method,
      requestData: res?.config?.data ? JSON.parse(res.config.data) : undefined,
      serverMessage: res?.data?.message,
      serverDetail: res?.data?.detail || res?.data,
      error: e?.message
    })
    alert(res?.data?.message || 'Save failed')
  }
}

</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Foods</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="loadFoods">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn color="white" variant="flat" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> New
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="5">
          <v-text-field v-model="q" label="Search foods" density="compact" variant="outlined"
                        prepend-inner-icon="mdi-magnify" clearable @keyup.enter="loadFoods"/>
        </v-col>
        <v-col cols="12" md="4">
          <v-select
            :items="[{title:'All Categories', value:'ALL'}, ...categoryOptions]"
            v-model="catFilter" label="Category" density="compact" variant="outlined"
            @update:modelValue="loadFoods"
          />
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="loadFoods"><v-icon start>mdi-refresh</v-icon> Refresh</v-btn>
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="rows" :items-per-page="10" class="rounded-xl">
        <template #item.image="{ item }">
          <v-avatar size="40" rounded="lg">
            <v-img :src="item.imageUrl || 'https://via.placeholder.com/60x60?text=Food'" cover />
          </v-avatar>
        </template>

        <template #item.category="{ item }">
          {{ item.categoryId?.name || '—' }}
        </template>

        <template #item.avail="{ item }">
          <div class="d-flex ga-2 justify-center">
            <v-switch inset hide-details color="primary"
              :model-value="item.isActiveGlobal"
              @update:modelValue="val => toggleAvail(item, 'GLOBAL', val)" label="Global"/>
            <v-switch inset hide-details color="deep-purple"
              :model-value="item.isActiveKitchen"
              @update:modelValue="val => toggleAvail(item, 'KITCHEN', val)" label="Kitchen"/>
          </div>
        </template>

        <template #item.stock="{ item }">
          <div class="d-flex flex-column align-center">
            <div v-if="item.stockQty===null">Unlimited</div>
            <div v-else><strong>{{ item.stockQty }}</strong></div>
            <v-btn size="x-small" variant="text" @click="setStockQuick(item)">
              <v-icon start>mdi-database-edit</v-icon> Set
            </v-btn>
          </div>
        </template>

        <template #item.build="{ item }">
          <v-chip size="x-small" class="mr-1" variant="outlined" color="primary">
            {{ (item.ingredients?.length || 0) }} ingredients
          </v-chip>
          <v-chip size="x-small" variant="outlined" color="purple">
            {{ (item.choiceGroups?.length || 0) }} choices
          </v-chip>
        </template>

        <template #item.updatedAt="{ item }">
          {{ new Date(item.updatedAt).toLocaleString() }}
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn size="small" color="primary" variant="tonal" @click="openEdit(item)">
              <v-icon start>mdi-pencil</v-icon> Edit
            </v-btn>
            <v-btn size="small" color="red" variant="text" @click="removeOne(item)">
              <v-icon start>mdi-delete</v-icon> Delete
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>

    <!-- Dialog -->
    <v-dialog v-model="dialog" max-width="960">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Food' : 'New Food' }}</v-card-title>
        <v-card-text>
          <v-tabs v-model="tab" class="mb-3">
            <v-tab value="basic">Basic</v-tab>
            <v-tab value="ings">Ingredients</v-tab>
            <v-tab value="choices">Choices</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <!-- Basic -->
            <v-window-item value="basic">
              <v-form ref="formRef">
                <v-row dense>
                  <v-col cols="12" md="6"><v-text-field v-model="form.name" label="Name" :rules="[rules.required]" /></v-col>
                  <v-col cols="12" md="6"><v-select :items="categoryOptions" v-model="form.categoryId" label="Category" :rules="[rules.required]" /></v-col>
                  <v-col cols="12"><v-text-field v-model="form.imageUrl" label="Image URL" /></v-col>
                  <v-col cols="12"><v-textarea v-model="form.description" label="Description" rows="3" /></v-col>
                  <v-col cols="12"><v-combobox v-model="form.tags" multiple chips label="Tags (spicy, vegan, ...)" /></v-col>

                  <v-col cols="12" md="5">
                    <v-switch v-model="form.unlimited" color="primary" inset hide-details label="Unlimited stock" />
                  </v-col>
                  <v-col cols="12" md="7">
                    <v-text-field v-model.number="form.stockQty" :disabled="form.unlimited" type="number" min="0" label="Stock quantity" />
                  </v-col>
                </v-row>
              </v-form>
            </v-window-item>

            <!-- Ingredients attach -->
            <v-window-item value="ings">
              <div class="d-flex align-center justify-space-between mb-2">
                <h3 class="text-subtitle-1">Attach Ingredients</h3>
                <v-btn size="small" variant="tonal" color="primary" @click="addIngLine">
                  <v-icon start>mdi-plus</v-icon> Add
                </v-btn>
              </div>

              <v-table density="comfortable" class="rounded-lg">
                <thead>
                  <tr>
                    <th style="width:28%">Ingredient</th>
                    <th style="width:15%">Default</th>
                    <th style="width:15%">Removable</th>
                    <th>Value / Choice</th>
                    <th style="width:60px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(it, idx) in form.attachIngredients" :key="idx">
                    <td>
                      <v-select :items="ingredientOpts" v-model="it.ingredientId" placeholder="Select ingredient" />
                    </td>
                    <td class="text-center">
                      <v-switch v-model="it.defaultIncluded" inset hide-details color="primary" />
                    </td>
                    <td class="text-center">
                      <v-switch v-model="it.removable" inset hide-details />
                    </td>
                    <td>
                      <!-- Render by type -->
                      <template v-if="ingType(it.ingredientId) === 'PERCENT'">
                        <div class="d-flex ga-2">
                          <v-text-field v-model.number="it.defaultValue" type="number" label="Default %" />
                        </div>
                      </template>
                      <template v-else-if="ingType(it.ingredientId) === 'CHOICE'">
                        <v-select
                          :items="(ingDef(it.ingredientId)?.choices || []).map(c => ({ title:c.label, value:c.value }))"
                          v-model="it.defaultValue"
                          label="Default choice"
                        />
                      </template>
                      <template v-else>
                        <span class="text-medium-emphasis">Boolean (no extra value)</span>
                      </template>
                    </td>
                    <td class="text-right">
                      <v-btn icon size="small" variant="text" color="red" @click="delIngLine(idx)">
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </td>
                  </tr>
                  <tr v-if="form.attachIngredients.length===0">
                    <td colspan="5" class="text-center text-medium-emphasis">No ingredients attached.</td>
                  </tr>
                </tbody>
              </v-table>
            </v-window-item>

            <!-- Choice Groups attach -->
            <v-window-item value="choices">
              <div class="d-flex align-center justify-space-between mb-2">
                <h3 class="text-subtitle-1">Attach Choice Groups</h3>
                <v-btn size="small" variant="tonal" color="primary" @click="addGrpLine">
                  <v-icon start>mdi-plus</v-icon> Add
                </v-btn>
              </div>

              <v-table density="comfortable" class="rounded-lg">
                <thead>
                  <tr>
                    <th style="width:35%">Group</th>
                    <th>Default choice</th>
                    <th style="width:60px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(g, idx) in form.attachGroups" :key="idx">
                    <td>
                      <v-select :items="groupOpts" v-model="g.groupId" placeholder="Select group" />
                    </td>
                    <td>
                      <v-select
                        :items="(grpDef(g.groupId)?.choices || []).map(c => ({ title:c.label, value:c.value }))"
                        v-model="g.defaultChoice"
                        label="Default choice"
                      />
                    </td>
                    <td class="text-right">
                      <v-btn icon size="small" variant="text" color="red" @click="delGrpLine(idx)">
                        <v-icon>mdi-delete</v-icon>
                      </v-btn>
                    </td>
                  </tr>
                  <tr v-if="form.attachGroups.length===0">
                    <td colspan="3" class="text-center text-medium-emphasis">No groups attached.</td>
                  </tr>
                </tbody>
              </v-table>
            </v-window-item>
          </v-window>
        </v-card-text>

        <v-card-actions>
          <v-spacer/><v-btn variant="text" @click="dialog=false">Cancel</v-btn>
          <v-btn color="primary" @click="save"><v-icon start>mdi-content-save</v-icon> Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-fab icon="mdi-plus" app location="bottom end" color="primary" @click="openCreate" />
  </v-card>
</template>

<style scoped>
.v-switch .v-label { font-size: 12px }
</style>
