<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'
import { useAuth } from '@/store/auth'

const auth = useAuth()

/* ───────────────── state ───────────────── */
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

/* ───────────────── headers for table ───────────────── */
const userHeaders = [
  { title: 'User',    key: 'name',      sortable: true },
  { title: 'Email',   key: 'email',     sortable: true },
  { title: 'Role',    key: 'role' },
  { title: 'Kitchen', key: 'kitchenId' },
  { title: 'Active',  key: 'isActive',  align: 'center' },
  { title: '',        key: 'actions',   align: 'end', sortable: false }
]

/* If you need the real “active admin count” across all pages,
   ask the backend for it. For now we compute from visible rows. */
const adminCount = computed(() =>
  rows.value.filter(r => r.role === 'ADMIN' && r.isActive).length
)

/* Pagination helpers */
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
const canPrev = computed(() => page.value > 1)
const canNext = computed(() => page.value < pageCount.value)

/* ───────────────── api ───────────────── */
const load = async () => {
  loading.value = true
  try {
    const { data } = await api.get('/users', {
      params: {
        role: roleFilter.value || undefined,
        q: q.value || undefined,
        page: page.value,
        limit: limit.value
      }
    })
    rows.value = data.data || data.rows || []
    total.value = Number(data.total || rows.value.length)
  } finally {
    loading.value = false
  }
}

/* Reset to first page and reload when filters/search change */
function applyFilters() {
  page.value = 1
  load()
}

/* Pagination actions */
function goPrev() {
  if (!canPrev.value) return
  page.value -= 1
  load()
}
function goNext() {
  if (!canNext.value) return
  page.value += 1
  load()
}

/* ───────────────── CRUD ───────────────── */
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
    const payload = {
      name: form.value.name,
      email: form.value.email,
      role: form.value.role,
      kitchenId: form.value.kitchenId || ''
    }
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

/* ───────────────── guards ───────────────── */
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
    <div class="d-flex align-center justify-space-between mb-3">
      <h2 class="text-h6">Users</h2>
      <div class="text-medium-emphasis">
        {{ total }} users · Active admins (visible page): {{ adminCount }}
      </div>
    </div>

    <!-- toolbar -->
    <div class="d-flex align-center mt-4" style="gap:12px; flex-wrap: wrap;">
      <v-select
        v-model="roleFilter"
        :items="roles"
        label="Filter role"
        variant="outlined"
        density="compact"
        clearable
        style="max-width:180px"
        @update:model-value="applyFilters"
        @click:clear="applyFilters"
      />
      <v-text-field
        v-model="q"
        label="Search name/email"
        variant="outlined"
        density="compact"
        style="max-width:260px"
        @keyup.enter="applyFilters"
        clearable
        @click:clear="applyFilters"
      />
      <v-btn color="primary" class="mb-4" @click="openCreate">
        <v-icon start>mdi-account-plus</v-icon> Add User
      </v-btn>
      <v-spacer />
      <v-btn variant="text" class="mb-4" :loading="loading" @click="load">
        <v-icon start>mdi-refresh</v-icon> Refresh
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate class="mb-2" />

    <v-data-table
      :headers="userHeaders"
      :items="rows"
      item-key="_id"
      density="compact"
      hover
      class="rounded-xl elevation-1"
    >
      <!-- User -->
      <template #item.name="{ item }">
        <div class="d-flex align-center ga-3">
          <v-avatar size="28" color="primary">
            <span class="text-white">{{ (item.name || item.email || '').slice(0,1).toUpperCase() }}</span>
          </v-avatar>
          <div>
            <div class="d-flex align-center ga-2">
              <strong>{{ item.name || '—' }}</strong>
              <v-chip v-if="isMe(item)" size="x-small" color="primary" variant="tonal">you</v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">#{{ item._id.slice(-6) }}</div>
          </div>
        </div>
      </template>

      <!-- Email -->
      <template #item.email="{ item }">
        <div class="d-flex align-center ga-1">
          <span class="font-mono">{{ item.email }}</span>
          <v-tooltip text="Copy email">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon size="x-small" variant="text"
                @click="navigator.clipboard && navigator.clipboard.writeText(item.email)"
              >
                <v-icon>mdi-content-copy</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </template>

      <!-- Role -->
      <template #item.role="{ item }">
        <v-select
          v-model="item.role"
          :items="roles"
          density="compact"
          variant="outlined"
          :disabled="disableRoleSelect(item)"
          style="max-width:160px"
          @update:model-value="val => api.put(`/users/${item._id}`, { role: val }).then(load)"
        />
      </template>

      <!-- Kitchen -->
      <template #item.kitchenId="{ item }">
        <v-text-field
          v-model="item.kitchenId"
          density="compact"
          variant="outlined"
          :disabled="item.role !== 'CHEF'"
          style="max-width:160px"
          @change="() => api.put(`/users/${item._id}`, { kitchenId: item.kitchenId || '' }).then(load)"
        />
      </template>

      <!-- Active -->
      <template #item.isActive="{ item }">
        <v-switch
          :model-value="item.isActive"
          inset
          density="compact"
          :disabled="disableDeactivate(item)"
          @update:model-value="v => toggleActive(item, v)"
        />
      </template>

      <!-- Actions -->
      <template #item.actions="{ item }">
        <div class="d-flex ga-1 justify-end">
          <v-tooltip text="Edit">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon size="small" @click="openEdit(item)">
                <v-icon>mdi-pencil</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Reset password">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon size="small"
                variant="tonal"
                :disabled="isMe(item)"
                @click="resetPassword(item)"
              >
                <v-icon>mdi-lock-reset</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Delete">
            <template #activator="{ props }">
              <v-btn
                v-bind="props"
                icon size="small"
                color="error"
                :disabled="disableDelete(item)"
                @click="removeOne(item)"
              >
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </template>

      <template #no-data>
        <div class="text-medium-emphasis pa-6">No users found.</div>
      </template>
    </v-data-table>

    <!-- Pager -->
    <div class="d-flex justify-end align-center mt-3" style="gap:8px">
      <div class="text-caption text-medium-emphasis">
        Page {{ page }} / {{ pageCount }}
      </div>
      <v-btn :disabled="!canPrev" @click="goPrev">Prev</v-btn>
      <v-btn :disabled="!canNext" @click="goNext">Next</v-btn>
    </div>

    <!-- Dialog -->
    <v-dialog v-model="dialog" max-width="520">
      <v-card>
        <v-card-title>{{ editing ? 'Edit User' : 'Add User' }}</v-card-title>
        <v-card-text>
          <v-text-field v-model="form.name" label="Name" variant="outlined" density="compact"/>
          <v-text-field v-model="form.email" label="Email" variant="outlined" density="compact"/>
          <v-select v-model="form.role" :items="roles" label="Role" variant="outlined" density="compact"/>
          <v-text-field
            v-model="form.kitchenId"
            label="Kitchen ID (CHEF only)"
            :disabled="form.role!=='CHEF'"
            variant="outlined"
            density="compact"
          />
          <v-text-field
            v-if="!editing"
            v-model="form.password"
            label="Password"
            type="password"
            variant="outlined"
            density="compact"
          />
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

<style scoped>
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
</style>
