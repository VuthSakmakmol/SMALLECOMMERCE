<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

const loading = ref(false)
const rows = ref([])
const q = ref('')

const dialog = ref(false)
const editing = ref(null)
const formRef = ref(null)

const form = ref({
  name: '',
  key: '',
  required: false,
  choices: [] // [{label,value}]
})

const headers = [
  { title: 'Name', key: 'name' },
  { title: 'Key', key: 'key', width: 140 },
  { title: 'Required', key: 'req', width: 110 },
  { title: 'Choices', key: 'choices' },
  { title: 'Actions', key: 'actions', align: 'end', width: 170 }
]

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (q.value.trim()) params.set('q', q.value.trim())
    const { data } = await api.get(`/choice-groups?${params.toString()}`)
    rows.value = data
  } finally { loading.value = false }
}

function openCreate () {
  editing.value = null
  form.value = { name:'', key:'', required:false, choices:[] }
  dialog.value = true
}
function openEdit (r) {
  editing.value = r
  form.value = {
    name: r.name,
    key: r.key,
    required: !!r.required,
    choices: Array.isArray(r.choices) ? r.choices.map(c => ({ label:c.label, value:c.value })) : []
  }
  dialog.value = true
}

function addChoice(){ form.value.choices.push({ label:'', value:'' }) }
function delChoice(i){ form.value.choices.splice(i,1) }

async function save () {
  const payload = {
    name: String(form.value.name || '').trim(),
    key: String(form.value.key || '').trim(),
    required: !!form.value.required,
    choices: (form.value.choices || [])
      .map(c => ({ label:String(c.label||'').trim(), value:String(c.value||'').trim() }))
      .filter(c => c.label && c.value)
  }
  if (!payload.name) return alert('Name required')
  if (!payload.key) return alert('Key required')
  if (!payload.choices.length) return alert('Add at least one choice')

  try {
    if (editing.value) {
      const { data } = await api.put(`/choice-groups/${editing.value._id}`, payload)
      const i = rows.value.findIndex(r => r._id === data._id); if (i !== -1) rows.value[i] = data
    } else {
      const { data } = await api.post('/choice-groups', payload)
      rows.value.unshift(data)
    }
    dialog.value = false
  } catch (e) {
    alert(e?.response?.data?.message || 'Save failed')
  }
}

async function removeOne (r) {
  if (!confirm(`Delete group "${r.name}"?`)) return
  try {
    await api.delete(`/choice-groups/${r._id}`)
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
      <v-toolbar-title>Choice Groups</v-toolbar-title>
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
          <v-text-field v-model="q" label="Search" density="compact" variant="outlined"
                        prepend-inner-icon="mdi-magnify" clearable @keyup.enter="load"/>
        </v-col>
        <v-col cols="12" md="3">
          <v-btn :loading="loading" block @click="load"><v-icon start>mdi-refresh</v-icon> Refresh</v-btn>
        </v-col>
      </v-row>

      <v-data-table :headers="headers" :items="rows" :items-per-page="10" class="rounded-xl">
        <template #item.req="{ item }">
          <v-chip size="small" :color="item.required ? 'green' : 'grey'">
            {{ item.required ? 'Yes' : 'No' }}
          </v-chip>
        </template>
        <template #item.choices="{ item }">
          <v-chip v-for="c in item.choices" :key="c.value" size="x-small" class="mr-1" variant="outlined">
            {{ c.label }}
          </v-chip>
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
        <v-card-title>{{ editing ? 'Edit Group' : 'New Group' }}</v-card-title>
        <v-card-text>
          <v-form ref="formRef">
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.name" label="Name" />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field v-model="form.key" label="Key (unique, e.g. coffee_type)" />
              </v-col>
              <v-col cols="12" md="6">
                <v-switch v-model="form.required" label="Required" inset />
              </v-col>

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
                    <tr v-for="(c,idx) in form.choices" :key="idx">
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
