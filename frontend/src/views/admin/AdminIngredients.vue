<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const q = ref('')
const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)

const TYPE_OPTS = ['BOOLEAN','PERCENT','CHOICE']

const form = ref({
  name: '',
  type: 'BOOLEAN',
  // percent
  min: 0, max: 100, step: 10, defaultValue: 100,
  // choice
  choices: [],          // [{label,value}]
  defaultChoice: null,
})

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Type', key: 'type', width: 120 },
  { title: 'Details', key: 'details' },
  { title: 'Actions', key: 'actions', align: 'end', width: 170 }
]

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return rows.value
  return rows.value.filter(r =>
    r.name.toLowerCase().includes(s) || (r.slug || '').toLowerCase().includes(s))
})

const rules = { required: v => !!String(v || '').trim() || 'Required' }

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value) params.set('q', q.value)
    const { data } = await api.get(`/ingredients?${params.toString()}`)
    rows.value = data
  } finally { loading.value = false }
}

function openCreate () {
  editing.value = null
  form.value = { name:'', type:'BOOLEAN', min:0, max:100, step:10, defaultValue:100, choices:[], defaultChoice:null }
  dialog.value = true
}
function openEdit (r) {
  editing.value = r
  form.value = {
    name: r.name,
    type: r.type,
    min: r.min ?? 0,
    max: r.max ?? 100,
    step: r.step ?? 10,
    defaultValue: r.defaultValue ?? (r.type==='PERCENT'?100:null),
    choices: Array.isArray(r.choices) ? r.choices.map(c => ({ label:c.label, value:c.value })) : [],
    defaultChoice: r.defaultChoice ?? null,
  }
  dialog.value = true
}

function addChoice () { form.value.choices.push({ label:'', value:'' }) }
function delChoice (idx) { form.value.choices.splice(idx, 1) }

async function save () {
  const ok = await formRef.value?.validate()
  if (!ok?.valid) return

  const payload = {
    name: form.value.name.trim(),
    type: form.value.type
  }

  if (form.value.type === 'PERCENT') {
    payload.min = Number.isFinite(+form.value.min) ? +form.value.min : 0
    payload.max = Number.isFinite(+form.value.max) ? +form.value.max : 100
    payload.step = Number.isFinite(+form.value.step) ? +form.value.step : 10
    payload.defaultValue = Number.isFinite(+form.value.defaultValue) ? +form.value.defaultValue : 100
  } else if (form.value.type === 'CHOICE') {
    const choices = (form.value.choices || [])
      .map(c => ({ label:String(c.label||'').trim(), value:String(c.value||'').trim() }))
      .filter(c => c.label && c.value)
    if (!choices.length) return alert('Add at least one choice')
    payload.choices = choices
    payload.defaultChoice = choices.find(c => c.value === form.value.defaultChoice)?.value ?? choices[0].value
  }

  try {
    if (editing.value) {
      const { data } = await api.put(`/ingredients/${editing.value._id}`, payload)
      const i = rows.value.findIndex(r => r._id === data._id); if (i !== -1) rows.value[i] = data
    } else {
      const { data } = await api.post('/ingredients', payload)
      rows.value.unshift(data)
    }
    dialog.value = false
  } catch (e) {
    alert(e?.response?.data?.message || 'Save failed')
  }
}

async function removeOne (r) {
  if (!confirm(`Delete ingredient "${r.name}"?`)) return
  try {
    await api.delete(`/ingredients/${r._id}`)
    rows.value = rows.value.filter(x => x._id !== r._id)
  } catch (e) {
    alert(e?.response?.data?.message || 'Delete failed')
  }
}

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl">
      <v-toolbar-title>Ingredients Library</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
        <v-btn color="white" variant="flat" @click="openCreate">
          <v-icon start>mdi-plus</v-icon> New
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-4">
      <v-row dense class="mb-3">
        <v-col cols="12" md="6">
          <v-text-field v-model="q" label="Search ingredients" density="compact" variant="outlined"
                        prepend-inner-icon="mdi-magnify" clearable @keyup.enter="load"/>
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="load"><v-icon start>mdi-refresh</v-icon> Refresh</v-btn>
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="filtered" :items-per-page="10" class="rounded-xl">
        <template #item.details="{ item }">
          <div v-if="item.type==='PERCENT'">
            Range: {{ item.min }}–{{ item.max }} (step {{ item.step }}), default {{ item.defaultValue }}%
          </div>
          <div v-else-if="item.type==='CHOICE'">
            <v-chip v-for="c in item.choices" :key="c.value" size="x-small" class="mr-1" variant="outlined">
              {{ c.label }}<span v-if="item.defaultChoice===c.value"> (default)</span>
            </v-chip>
          </div>
          <div v-else>Boolean (on/off)</div>
        </template>

        <template #item.actions="{ item }">
          <div class="d-flex ga-2 justify-end">
            <v-btn size="small" variant="tonal" color="primary" @click="openEdit(item)">
              <v-icon start>mdi-pencil</v-icon> Edit
            </v-btn>
            <v-btn size="small" variant="text" color="red" @click="removeOne(item)">
              <v-icon start>mdi-delete</v-icon> Delete
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </div>

    <v-dialog v-model="dialog" max-width="720">
      <v-card>
        <v-card-title>{{ editing ? 'Edit Ingredient' : 'New Ingredient' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.name" label="Name" :rules="[rules.required]" />
              </v-col>
              <v-col cols="12" md="6">
                <v-select :items="TYPE_OPTS" v-model="form.type" label="Type" />
              </v-col>

              <template v-if="form.type==='PERCENT'">
                <v-col cols="12" md="3"><v-text-field v-model.number="form.min" type="number" label="Min" /></v-col>
                <v-col cols="12" md="3"><v-text-field v-model.number="form.max" type="number" label="Max" /></v-col>
                <v-col cols="12" md="3"><v-text-field v-model.number="form.step" type="number" label="Step" /></v-col>
                <v-col cols="12" md="3"><v-text-field v-model.number="form.defaultValue" type="number" label="Default %" /></v-col>
              </template>

              <template v-else-if="form.type==='CHOICE'">
                <v-col cols="12">
                  <div class="d-flex align-center justify-space-between mb-2">
                    <h3 class="text-subtitle-1">Choices</h3>
                    <v-btn size="small" variant="tonal" color="primary" @click="addChoice">
                      <v-icon start>mdi-plus</v-icon> Add
                    </v-btn>
                  </div>
                  <v-table density="comfortable" class="rounded-lg">
                    <thead><tr><th>Label</th><th>Value</th><th width="80"></th></tr></thead>
                    <tbody>
                      <tr v-for="(c, idx) in form.choices" :key="idx">
                        <td><v-text-field v-model="c.label" placeholder="Latte" /></td>
                        <td><v-text-field v-model="c.value" placeholder="latte" /></td>
                        <td class="text-right">
                          <v-btn icon size="small" variant="text" color="red" @click="delChoice(idx)">
                            <v-icon>mdi-delete</v-icon>
                          </v-btn>
                        </td>
                      </tr>
                      <tr v-if="form.choices.length===0">
                        <td colspan="3" class="text-center text-medium-emphasis">No choices yet.</td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-col>
                <v-col cols="12">
                  <v-select
                    :items="form.choices.map(c => ({ title: c.label || c.value, value: c.value }))"
                    v-model="form.defaultChoice"
                    label="Default choice"
                  />
                </v-col>
              </template>

              <template v-else>
                <v-col cols="12" class="text-medium-emphasis">
                  Boolean ingredient. Default include/removable is set per food attachment.
                </v-col>
              </template>
            </v-row>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer/><v-btn variant="text" @click="dialog=false">Cancel</v-btn>
          <v-btn color="primary" @click="save"><v-icon start>mdi-content-save</v-icon> Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>
