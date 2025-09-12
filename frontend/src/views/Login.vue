<!-- src/views/auth/Login.vue -->
<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuth } from '@/store/auth'

const router = useRouter()
const route  = useRoute()
const auth   = useAuth()
const { smAndDown } = useDisplay()

/* ───────── tabs ───────── */
const tab = ref('login')

/* ───────── login (by ID) ───────── */
const id       = ref('')
const password = ref('')
const showPw   = ref(false)

/* ───────── register ───────── */
const isGuest    = ref(true)   // default: Guest register
// employee-only
const rId        = ref('')
const rName      = ref('')
// guest-only
const guestFrom  = ref('')
const guestName  = ref('')

const rPassword  = ref('')
const rConfirm   = ref('')
const rShowPw    = ref(false)
const rShowPw2   = ref(false)

/* show generated guest ID after success */
const generatedId  = ref('')
const showIdDialog = ref(false)

/* ───────── rules ───────── */
const rules = {
  required: v => !!String(v || '').trim() || 'Required',
  min6: v => String(v || '').length >= 6 || 'Min 6 characters',
  match: v => v === rPassword.value || 'Passwords do not match',
}

/* ───────── derived ───────── */
const loginError = computed(() => tab.value === 'login' ? auth.error : null)
const regLoading = computed(() => auth.loading && tab.value === 'register')
const canLogin = computed(() =>
  !!id.value && password.value.length >= 6 && !auth.loading
)

/* guest display name MUST be provided; employee needs ID+Name */
const canRegister = computed(() => {
  if (isGuest.value) {
    const hasName = !!String(guestName.value || '').trim()
    return hasName && rPassword.value.length >= 6 && rPassword.value === rConfirm.value && !regLoading.value
  }
  return (
    !!rId.value &&
    !!rName.value &&
    rPassword.value.length >= 6 &&
    rPassword.value === rConfirm.value &&
    !regLoading.value
  )
})

function routeByRole(role) {
  const next = route.query.next || null
  if (role === 'ADMIN') router.push(next || '/admin')
  else if (role === 'CHEF') router.push(next || '/chef')
  else router.push(next || '/customer')
}

/* ───────── effects ───────── */
onMounted(() => { if (auth.isAuthed) routeByRole(auth.role) })

watch([id, password, rId, rName, guestFrom, guestName, rPassword, rConfirm, isGuest, tab], () => {
  if (auth.error) auth.error = null
})

/* ───────── actions ───────── */
async function submitLogin() {
  if (!canLogin.value) return
  const ok = await auth.login(id.value.trim(), password.value)
  if (ok) routeByRole(auth.role)
}

async function submitRegister() {
  if (!canRegister.value) return
  let ok = false
  if (isGuest.value) {
    const rawName = guestName.value.trim()
    // BE will append " (guest)" if missing; pass rawName as displayName
    ok = await auth.registerGuest({
      password: rPassword.value,
      displayName: rawName,
      fromCompany: guestFrom.value.trim(),
    })
    if (ok) {
      generatedId.value = auth.user?.id || ''
      showIdDialog.value = true
      return
    }
  } else {
    ok = await auth.registerCustomer({
      id: rId.value.trim(),
      username: rName.value.trim(),
      password: rPassword.value,
    })
    if (ok) routeByRole(auth.role)
  }
}
</script>

<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <!-- Left brand panel (hidden on small) -->
      <v-col
        cols="12" md="6"
        class="d-flex flex-column align-center justify-center text-white"
        :style="{ background:'linear-gradient(135deg, #FF6B35, #FFB347)', minHeight:'40vh' }"
        v-show="!smAndDown"
      >
        <v-icon size="100" color="white" class="mb-4">mdi-silverware-fork-knife</v-icon>
        <h1 class="text-h3 font-weight-bold mb-2">Food Chef</h1>
        <p class="text-body-1 opacity-80">Delicious food, managed with style.</p>
      </v-col>

      <!-- Right auth card -->
      <v-col cols="12" md="6" class="d-flex align-center justify-center" style="min-height: 100vh;">
        <v-card class="px-6 py-8 py-md-10 rounded-xl elevation-3" max-width="520" width="100%">
          <div class="text-center mb-6 d-md-none">
            <v-icon size="64" color="primary" class="mb-2">mdi-silverware-fork-knife</v-icon>
            <div class="text-h6 font-weight-bold">Food Chef</div>
          </div>

          <v-tabs v-model="tab" grow class="mb-6" density="comfortable">
            <v-tab value="login">Sign in</v-tab>
            <v-tab value="register">Register</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <!-- LOGIN -->
            <v-window-item value="login">
              <v-text-field
                v-model.trim="id"
                label="ID"
                variant="outlined"
                density="comfortable"
                autocomplete="username"
                prepend-inner-icon="mdi-card-account-details-outline"
                :rules="[rules.required]"
                @keyup.enter="submitLogin"
                class="mb-3"
              />
              <v-text-field
                v-model="password"
                :type="showPw ? 'text':'password'"
                label="Password"
                variant="outlined"
                density="comfortable"
                autocomplete="current-password"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                @click:append-inner="showPw = !showPw"
                :rules="[rules.required, rules.min6]"
                @keyup.enter="submitLogin"
                class="mb-4"
              />

              <v-alert v-if="loginError" type="error" variant="tonal" class="mb-4">{{ loginError }}</v-alert>
              <v-btn
                block color="primary" size="x-large" class="text-none"
                :loading="auth.loading"
                :disabled="!canLogin"
                @click="submitLogin"
              >
                Sign in
              </v-btn>
            </v-window-item>

            <!-- REGISTER -->
            <v-window-item value="register">
              <div class="d-flex align-center justify-space-between mb-3">
                <div class="text-body-2 text-medium-emphasis">Register as Guest</div>
                <v-switch v-model="isGuest" inset density="compact" color="primary" class="ma-0" />
              </div>

              <div v-if="isGuest" class="text-body-2 text-medium-emphasis mb-2">
                You’ll be registered as a Guest (ID will start with <b>99</b>). Display name is required.
              </div>
              <div v-else class="text-body-2 text-medium-emphasis mb-2">
                Register an Employee (set <b>ID</b> and display <b>Name</b>).
              </div>

              <!-- Guest-only fields -->
              <v-expand-transition>
                <div v-show="isGuest">
                  <v-text-field
                    v-model.trim="guestFrom"
                    label="Company / Where are you from (optional)"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-office-building-marker-outline"
                    class="mb-3"
                  />
                  <v-text-field
                    v-model.trim="guestName"
                    label="Display name"
                    :rules="[rules.required]"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-account-outline"
                    class="mb-3"
                  />
                </div>
              </v-expand-transition>

              <!-- Employee-only fields -->
              <v-expand-transition>
                <div v-show="!isGuest">
                  <v-text-field
                    v-model.trim="rId"
                    label="Employee ID"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-card-account-details-outline"
                    :rules="[rules.required]"
                    class="mb-3"
                  />
                  <v-text-field
                    v-model.trim="rName"
                    label="Display Name"
                    variant="outlined"
                    density="comfortable"
                    prepend-inner-icon="mdi-account-outline"
                    :rules="[rules.required]"
                    class="mb-3"
                  />
                </div>
              </v-expand-transition>

              <!-- Password + Confirm (common) -->
              <v-text-field
                v-model="rPassword"
                :type="rShowPw ? 'text':'password'"
                label="Password"
                variant="outlined"
                density="comfortable"
                autocomplete="new-password"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="rShowPw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                @click:append-inner="rShowPw = !rShowPw"
                :rules="[rules.required, rules.min6]"
                class="mb-3"
              />
              <v-text-field
                v-model="rConfirm"
                :type="rShowPw2 ? 'text':'password'"
                label="Confirm password"
                variant="outlined"
                density="comfortable"
                autocomplete="new-password"
                prepend-inner-icon="mdi-lock-check-outline"
                :append-inner-icon="rShowPw2 ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                @click:append-inner="rShowPw2 = !rShowPw2"
                :rules="[rules.required, rules.match]"
                class="mb-4"
              />

              <v-alert v-if="auth.error && tab==='register'" type="error" variant="tonal" class="mb-4">
                {{ auth.error }}
              </v-alert>
              <v-btn
                block color="primary" size="x-large" class="text-none"
                :loading="regLoading"
                :disabled="!canRegister"
                @click="submitRegister"
              >
                Create account
              </v-btn>
            </v-window-item>
          </v-window>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog: show generated ID for guests -->
    <v-dialog v-model="showIdDialog" max-width="480">
      <v-card class="pa-4">
        <div class="text-h6 mb-2">Guest account created</div>
        <div class="mb-4">
          <div class="text-body-2 text-medium-emphasis">Your login ID — please keep it safe to sign in later:</div>
          <v-alert type="info" variant="tonal" class="mt-2">
            <div class="d-flex align-center justify-space-between">
              <strong style="font-size:1.1rem">{{ generatedId }}</strong>
              <v-btn size="small" variant="text" @click="navigator.clipboard.writeText(generatedId)">Copy</v-btn>
            </div>
          </v-alert>
        </div>
        <v-btn block color="primary" @click="routeByRole(auth.role)">Continue</v-btn>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.opacity-80 { opacity: .8; }
@media (max-width: 600px){ .v-card { box-shadow: none !important; } }
</style>
