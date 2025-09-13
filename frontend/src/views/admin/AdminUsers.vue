<!-- src/views/admin/AdminUsers.vue -->
<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '@/utils/api'
import { useAuth } from '@/store/auth'

const auth = useAuth()

/* ───────── state ───────── */
const rows   = ref([])
const total  = ref(0)
const page   = ref(1)
const limit  = ref(10)

const roleFilter = ref('')
const q          = ref('')
const loading    = ref(false)

const dialog  = ref(false)
const editing = ref(null) // null = create

// Admin can create ONLY non-guest users here.
const form = ref({
  loginId: '',
  name: '',
  password: '',
  role: 'CUSTOMER',
  kitchenId: ''
})

const roles = ['ADMIN', 'CHEF', 'CUSTOMER']
const GUEST_PREFIX = '99'

/* ───────── helpers ───────── */
const adminCountVisible = computed(
  () => rows.value.filter(r => r.role === 'ADMIN' && r.isActive).length
)
const pageCount = computed(() => Math.max(1, Math.ceil(total.value / limit.value)))
const canPrev   = computed(() => page.value > 1)
const canNext   = computed(() => page.value < pageCount.value)

const isMe = (u) => String(u._id) === String(auth.user?._id)
const disableDeactivate = (u) => isMe(u) || (u.role === 'ADMIN' && adminCountVisible.value <= 1 && u.isActive)
const disableDelete     = (u) => isMe(u) || (u.role === 'ADMIN' && adminCountVisible.value <= 1 && u.isActive)
const disableRoleSelect = (u) => isMe(u) || u.isGuest // guests: role locked to CUSTOMER

const isGuestId = (id) => String(id || '').startsWith(GUEST_PREFIX)

/* ───────── api ───────── */
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
    rows.value  = data.data || data.rows || []
    total.value = Number(data.total || rows.value.length)
  } finally {
    loading.value = false
  }
}

function applyFilters () { page.value = 1; load() }
function goPrev () { if (canPrev.value) { page.value -= 1; load() } }
function goNext () { if (canNext.value) { page.value += 1; load() } }

/* ───────── CRUD ───────── */
const openCreate = () => {
  editing.value = null
  form.value = { loginId: '', name: '', password: '', role: 'CUSTOMER', kitchenId: '' }
  dialog.value = true
}

const openEdit = (u) => {
  editing.value = u._id
  form.value = {
    loginId:  u.loginId || '',
    name:     u.name || '',
    password: '',
    role:     u.role || 'CUSTOMER',
    kitchenId: u.kitchenId || ''
  }
  dialog.value = true
}

const save = async () => {
  if (!form.value.loginId) { alert('ID (loginId) required'); return }
  if (!editing.value && (!form.value.password || form.value.password.length < 6)) {
    alert('Password min 6 chars'); return
  }
  if (!roles.includes(form.value.role)) { alert('Invalid role'); return }
  if (!form.value.name || !form.value.name.trim()) { alert('Display name required'); return }

  if (!editing.value && isGuestId(form.value.loginId)) {
    alert(`Guest IDs (${GUEST_PREFIX}xxxx) cannot be created here. Ask the user to self-register as Guest on the Login page.`)
    return
  }

  const payloadBase = {
    loginId:  form.value.loginId,
    name:     form.value.name.trim(),
    role:     form.value.role,
    kitchenId: form.value.kitchenId || ''
  }

  try {
    if (editing.value) {
      await api.put(`/users/${editing.value}`, payloadBase)
    } else {
      await api.post('/users', { ...payloadBase, password: form.value.password })
    }
    dialog.value = false
    await load()
  } catch (e) {
    alert(e?.response?.data?.message || 'Save failed')
  }
}

const toggleActive = async (u, v) => {
  try {
    await api.patch(`/users/${u._id}/toggle`, { value: v })
    await load()
  } catch (e) {
    alert(e?.response?.data?.message || 'Toggle failed')
    await load()
  }
}

const resetPassword = async (u) => {
  const pwd = prompt(`New password for ${u.name} (#${u.loginId}):`, '')
  if (!pwd) return
  if (String(pwd).length < 6) { alert('Password min 6 chars'); return }
  try {
    await api.patch(`/users/${u._id}/password`, { password: pwd })
    alert('Password updated')
  } catch (e) {
    alert(e?.response?.data?.message || 'Reset failed')
  }
}

const removeOne = async (u) => {
  if (!confirm(`Delete ${u.name} (#${u.loginId})?`)) return
  try {
    await api.delete(`/users/${u._id}`)
    await load()
  } catch (e) {
    alert(e?.response?.data?.message || 'Delete failed')
  }
}

/* ───────── lifecycle ───────── */
onMounted(load)
</script>

<template>
  <div class="pa-2">
    <div class="d-flex align-center justify-space-between mb-3">
      <div class="text-medium-emphasis">
        {{ total }} users · Active admins (visible page): {{ rows.filter(r => r.role==='ADMIN' && r.isActive).length }}
      </div>
    </div>

    <!-- toolbar -->
    <div class="d-flex align-center mt-4" style="gap:12px; flex-wrap: wrap;">
      <!-- v-select → v-autocomplete (autocomplete filter) -->
      <v-autocomplete
        v-model="roleFilter"
        :items="roles"
        label="Filter role"
        variant="outlined"
        density="compact"
        clearable
        style="max-width:180px"
        auto-select-first
        @update:model-value="applyFilters"
        @click:clear="applyFilters"
      />
      <v-text-field
        v-model="q"
        label="Search name / ID"
        variant="outlined"
        density="compact"
        style="max-width:260px"
        @keyup.enter="applyFilters"
        clearable
        @click:clear="applyFilters"
      />
      <v-btn color="orange" class="mb-4" @click="openCreate">
        <v-icon start>mdi-account-plus</v-icon> Add User
      </v-btn>
      <v-spacer />
      <v-btn variant="text" color="orange" class="mb-4" :loading="loading" @click="load">
        <v-icon start>mdi-refresh</v-icon> Refresh
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate class="mb-2" />

    <v-data-table
      :headers="[
        { title: 'User', key: 'name', sortable: true, width: 280 },
        { title: 'Login ID', key: 'loginId', sortable: true, width: 160 },
        { title: 'Role', key: 'role', width: 160 },
        { title: 'Guest', key: 'isGuest', align: 'center', width: 90 },
        { title: 'Kitchen', key: 'kitchenId', width: 160 },
        { title: 'Active', key: 'isActive', align: 'center', width: 110 },
        { title: '', key: 'actions', align: 'end', sortable: false, width: 160 }
      ]"
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
            <span class="text-white">{{ (item.name || '').slice(0,1).toUpperCase() }}</span>
          </v-avatar>
          <div>
            <div class="d-flex align-center ga-2">
              <strong>{{ item.name || '—' }}</strong>
              <v-chip v-if="item.isGuest" size="x-small" color="purple" variant="tonal">guest</v-chip>
              <v-chip v-if="isMe(item)" size="x-small" color="primary" variant="tonal">you</v-chip>
            </div>
            <div class="text-caption text-medium-emphasis">#{{ String(item._id || '').slice(-6) }}</div>
          </div>
        </div>
      </template>

      <!-- Login ID -->
      <template #item.loginId="{ item }">
        <div class="d-flex align-center ga-1">
          <span class="font-mono">{{ item.loginId }}</span>
          <v-tooltip text="Copy ID">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon size="x-small" variant="text"
                     @click="navigator.clipboard && navigator.clipboard.writeText(item.loginId)">
                <v-icon>mdi-content-copy</v-icon>
              </v-btn>
            </template>
          </v-tooltip>
        </div>
      </template>

      <!-- Role: v-select → v-autocomplete (inline editable) -->
      <template #item.role="{ item }">
        <v-autocomplete
          v-model="item.role"
          :items="roles"
          density="compact"
          variant="outlined"
          class="tiny-select"
          style="max-width:160px"
          :disabled="disableRoleSelect(item)"
          auto-select-first
          hide-no-data
          @update:model-value="val => api.put(`/users/${item._id}`, { role: val })
            .then(load)
            .catch(e => alert(e?.response?.data?.message || 'Update failed'))"
        />
      </template>

      <!-- Guest (read-only toggle) -->
      <template #item.isGuest="{ item }">
        <v-switch :model-value="item.isGuest" inset density="compact" :disabled="true" />
      </template>

      <!-- Kitchen -->
      <template #item.kitchenId="{ item }">
        <v-text-field
          v-model="item.kitchenId"
          density="compact"
          variant="outlined"
          :disabled="item.role !== 'CHEF'"
          style="max-width:160px;"
          @change="() => api.put(`/users/${item._id}`, { kitchenId: item.kitchenId || '' })
            .then(load)
            .catch(e => alert(e?.response?.data?.message || 'Update failed'))"
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
              <v-btn v-bind="props" icon size="small" variant="tonal"
                     :disabled="isMe(item)" @click="resetPassword(item)">
                <v-icon>mdi-lock-reset</v-icon>
              </v-btn>
            </template>
          </v-tooltip>

          <v-tooltip text="Delete">
            <template #activator="{ props }">
              <v-btn v-bind="props" icon size="small" color="error"
                     :disabled="disableDelete(item)" @click="removeOne(item)">
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

    <!-- pager -->
    <div class="d-flex justify-end align-center mt-3" style="gap:8px">
      <div class="text-caption text-medium-emphasis">Page {{ page }} / {{ pageCount }}</div>
      <v-btn :disabled="!canPrev" @click="goPrev">Prev</v-btn>
      <v-btn :disabled="!canNext" @click="goNext">Next</v-btn>
    </div>

    <!-- dialog -->
    <v-dialog v-model="dialog" max-width="600">
      <v-card>
        <v-card-title>{{ editing ? 'Edit User' : 'Add User' }}</v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.loginId"
                label="Login ID"
                variant="outlined"
                density="compact"
                hint="Guests must self-register (IDs starting with 99 cannot be created here)"
                persistent-hint
              />
            </v-col>

            <v-col cols="12" md="6">
              <!-- v-select → v-autocomplete -->
              <v-autocomplete
                v-model="form.role"
                :items="roles"
                label="Role"
                variant="outlined"
                density="compact"
                auto-select-first
                hide-no-data
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.name"
                label="Display Name"
                variant="outlined"
                density="compact"
                :rules="[v => !!(v && v.trim()) || 'Display name required']"
                placeholder="e.g., Tony"
              />
            </v-col>

            <v-col cols="12" md="6" v-if="!editing">
              <v-text-field
                v-model="form.password"
                label="Password"
                type="password"
                variant="outlined"
                density="compact"
              />
            </v-col>

            <v-col cols="12" md="6">
              <v-text-field
                v-model="form.kitchenId"
                label="Kitchen ID (CHEF only)"
                :disabled="form.role !== 'CHEF'"
                variant="outlined"
                density="compact"
              />
            </v-col>
          </v-row>

          <div class="text-caption mt-2 text-medium-emphasis">
            • Guests must self-register on the Login page. Admins cannot create IDs starting with <strong>{{ GUEST_PREFIX }}</strong> here.
            <br/>• You can’t change your own role or deactivate/delete your own account.
            <br/>• Backend prevents demoting/deactivating the last active admin.
          </div>
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

/* keep the shorter control for inline table editor */
.tiny-select .v-field {
  min-height: 28px !important;
  font-size: 13px !important;
  padding-top: 0 !important;
  padding-bottom: 0 !important;
}

/* ↓↓↓ extra tweak for phones */
@media (max-width: 600px) {
  .tiny-select .v-field {
    min-height: 24px !important;
    font-size: 11px !important;
  }
  .v-data-table {
    font-size: 12px; /* shrink whole table text */
  }
  .v-btn {
    font-size: 12px;
  }
}
</style>

