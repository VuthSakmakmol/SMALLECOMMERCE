<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'
import { useAuth } from '@/store/auth'

const auth = useAuth()

const rows = ref([])
const total = ref(0)
const page = ref(1)
const limit = ref(10)
const roleFilter = ref('')
const q = ref('')
const loading = ref(false)

const dialog = ref(false)
const editing = ref(null) // null=create
const form = ref({ name: '', email: '', password: '', role: 'CUSTOMER', kitchenId: '' })

const roles = ['ADMIN', 'CHEF', 'CUSTOMER']
const adminCount = computed(() => rows.value.filter(r => r.role === 'ADMIN' && r.isActive).length)

const load = async () => {
  loading.value = true
  try {
    const { data } = await api.get('/users', {
      params: { role: roleFilter.value || undefined, q: q.value || undefined, page: page.value, limit: limit.value }
    })
    rows.value = data.data
    total.value = data.total
  } finally { loading.value = false }
}

const openCreate = () => {
  editing.value = null
  form.value = { name: '', email: '', password: '', role: 'CUSTOMER', kitchenId: '' }
  dialog.value = true
}

const openEdit = (u) => {
  editing.value = u._id
  form.value = { name: u.name, email: u.email, password: '', role: u.role, kitchenId: u.kitchenId || '' }
  dialog.value = true
}

const save = async () => {
  if (editing.value) {
    const payload = { name: form.value.name, email: form.value.email, role: form.value.role, kitchenId: form.value.kitchenId }
    await api.put(`/users/${editing.value}`, payload)
  } else {
    await api.post('/users', form.value)
  }
  dialog.value = false
  await load()
}

const toggleActive = async (u, v) => {
  await api.patch(`/users/${u._id}/toggle`, { value: v })
  await load()
}

const resetPassword = async (u) => {
  const pwd = prompt(`New password for ${u.email}:`, '')
  if (!pwd) return
  await api.patch(`/users/${u._id}/password`, { password: pwd })
  alert('Password updated')
}

const removeOne = async (u) => {
  if (!confirm(`Delete ${u.email}?`)) return
  await api.delete(`/users/${u._id}`)
  await load()
}

const isMe = (u) => String(u._id) === String(auth.user?._id)
const disableDeactivate = (u) =>
  isMe(u) || (u.role === 'ADMIN' && adminCount.value <= 1 && u.isActive)
const disableDelete = (u) =>
  isMe(u) || (u.role === 'ADMIN' && adminCount.value <= 1 && u.isActive)
const disableRoleSelect = (u) => isMe(u) // cannot change own role
onMounted(load)
</script>

<template>
  <div class="pa-2">
    <h2>Users</h2>

    <div class="d-flex align-center mb-4" style="gap:12px;flex-wrap:wrap">
      <v-select v-model="roleFilter" :items="roles" label="Filter role" clearable style="max-width:180px" @update:model-value="() => { page=1; load() }" />
      <v-text-field v-model="q" label="Search name/email" style="max-width:260px" @keyup.enter="() => { page=1; load() }"/>
      <v-btn color="primary" @click="openCreate">Add User</v-btn>
      <v-spacer />
      <div>{{ total }} users · Admins active: {{ adminCount }}</div>
    </div>

    <v-progress-linear v-if="loading" indeterminate />
    <v-table v-else>
      <thead>
        <tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Kitchen</th><th>Active</th><th style="width:320px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="u in rows" :key="u._id">
          <td>
            {{ u.name }}
            <v-chip v-if="isMe(u)" size="x-small" class="ml-2" color="primary" variant="tonal">you</v-chip>
          </td>
          <td>{{ u.email }}</td>
          <td>
            <v-select
              v-model="u.role"
              :items="roles"
              density="compact"
              style="max-width:160px"
              :disabled="disableRoleSelect(u)"
              @update:model-value="val => api.put(`/users/${u._id}`, { role: val }).then(load)"
            />
          </td>
          <td style="max-width:160px">
            <v-text-field
              v-model="u.kitchenId"
              density="compact"
              :disabled="u.role !== 'CHEF'"
              @change="() => api.put(`/users/${u._id}`, { kitchenId: u.kitchenId }).then(load)"
            />
          </td>
          <td>
            <v-switch
              :model-value="u.isActive"
              :disabled="disableDeactivate(u)"
              @update:model-value="v => toggleActive(u, v)"
              inset density="compact"
            />
          </td>
          <td class="d-flex" style="gap:8px">
            <v-btn size="small" @click="openEdit(u)">Edit</v-btn>
            <v-btn size="small" variant="tonal" :disabled="isMe(u)" @click="resetPassword(u)">Reset Password</v-btn>
            <v-btn size="small" color="error" :disabled="disableDelete(u)" @click="removeOne(u)">Delete</v-btn>
          </td>
        </tr>
      </tbody>
    </v-table>

    <div class="d-flex justify-end mt-3" style="gap:8px">
      <v-btn :disabled="page<=1" @click="page--; load()">Prev</v-btn>
      <div class="px-2">Page {{ page }}</div>
      <v-btn :disabled="rows.length < limit" @click="page++; load()">Next</v-btn>
    </div>

    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ editing ? 'Edit User' : 'Add User' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Name" />
          <v-text-field v-model="form.email" label="Email" />
          <v-select v-model="form.role" :items="roles" label="Role" />
          <v-text-field v-model="form.kitchenId" label="Kitchen ID (CHEF only)" :disabled="form.role!=='CHEF'" />
          <v-text-field v-if="!editing" v-model="form.password" label="Password" type="password" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialog=false">Cancel</v-btn>
          <v-btn color="primary" @click="save">Save</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
  