<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useDisplay } from 'vuetify'
import { useAuth } from '@/store/auth'

const router = useRouter()
const route  = useRoute()
const auth = useAuth()
const { smAndDown } = useDisplay()

const tab = ref('login')

// login
const username = ref('')
const password = ref('')
const showPw   = ref(false)

// register
const rUsername = ref('')
const rPassword = ref('')
const rConfirm  = ref('')
const rShowPw   = ref(false)
const rShowPw2  = ref(false)

const rules = {
  required: v => !!String(v || '').trim() || 'Required',
  min6: v => String(v || '').length >= 6 || 'Min 6 characters',
}

const loginError = computed(() => auth.error)
const regLoading = computed(() => auth.loading && tab.value === 'register')
const canLogin = computed(() => username.value && password.value.length >= 6 && !auth.loading)
const canRegister = computed(() =>
  rUsername.value && rPassword.value.length >= 6 && rPassword.value === rConfirm.value && !regLoading.value
)

function routeByRole(role) {
  if (role === 'ADMIN') router.push(route.query.next || '/admin')
  else if (role === 'CHEF') router.push(route.query.next || '/chef')
  else router.push(route.query.next || '/customer')
}

onMounted(() => { if (auth.isAuthed) routeByRole(auth.role) })
watch([username, password, rUsername, rPassword, rConfirm, tab], () => auth.error && (auth.error = null))

async function submitLogin() {
  if (!canLogin.value) return
  const ok = await auth.login(username.value.trim(), password.value)
  if (ok) routeByRole(auth.role)
}

async function submitRegister() {
  if (!canRegister.value) return
  const ok = await auth.register(rUsername.value.trim(), rPassword.value)
  if (ok) routeByRole(auth.role)
}
</script>

<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <v-col cols="12" md="6" class="d-flex flex-column align-center justify-center text-white"
             :style="{ background:'linear-gradient(135deg, #FF6B35, #FFB347)', minHeight:'40vh' }"
             v-show="!smAndDown">
        <v-icon size="100" color="white" class="mb-4">mdi-silverware-fork-knife</v-icon>
        <h1 class="text-h3 font-weight-bold mb-2">Food Chef</h1>
        <p class="text-body-1 opacity-80">Delicious food, managed with style.</p>
      </v-col>

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
            <v-window-item value="login">
              <v-text-field v-model.trim="username" label="Username" variant="outlined" density="comfortable"
                            autocomplete="username" prepend-inner-icon="mdi-account-outline"
                            :rules="[rules.required]" @keyup.enter="submitLogin" class="mb-3"/>
              <v-text-field v-model="password" :type="showPw ? 'text':'password'" label="Password"
                            variant="outlined" density="comfortable" autocomplete="current-password"
                            prepend-inner-icon="mdi-lock-outline"
                            :append-inner-icon="showPw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                            @click:append-inner="showPw = !showPw"
                            :rules="[rules.required, rules.min6]" @keyup.enter="submitLogin" class="mb-4" />

              <v-alert v-if="loginError" type="error" variant="tonal" class="mb-4">{{ loginError }}</v-alert>
              <v-btn block color="primary" size="x-large" class="text-none" :loading="auth.loading"
                     :disabled="!canLogin" @click="submitLogin">Sign in</v-btn>
            </v-window-item>

            <v-window-item value="register">
              <div class="text-body-2 text-medium-emphasis mb-4">You’ll be registered as a Customer</div>
              <v-text-field v-model.trim="rUsername" label="Username" variant="outlined" density="comfortable"
                            autocomplete="username" prepend-inner-icon="mdi-account-outline"
                            :rules="[rules.required]" class="mb-3" @keyup.enter="submitRegister" />
              <v-text-field v-model="rPassword" :type="rShowPw ? 'text':'password'" label="Password"
                            variant="outlined" density="comfortable" autocomplete="new-password"
                            prepend-inner-icon="mdi-lock-outline"
                            :append-inner-icon="rShowPw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                            @click:append-inner="rShowPw = !rShowPw"
                            :rules="[rules.required, rules.min6]" class="mb-3" @keyup.enter="submitRegister" />
              <v-text-field v-model="rConfirm" :type="rShowPw2 ? 'text':'password'" label="Confirm password"
                            variant="outlined" density="comfortable" autocomplete="new-password"
                            prepend-inner-icon="mdi-lock-check-outline"
                            :append-inner-icon="rShowPw2 ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
                            @click:append-inner="rShowPw2 = !rShowPw2"
                            :rules="[v => !!v || 'Required', v => v === rPassword || 'Passwords do not match']"
                            class="mb-4" @keyup.enter="submitRegister" />
              <v-alert v-if="auth.error && tab==='register'" type="error" variant="tonal" class="mb-4">
                {{ auth.error }}
              </v-alert>
              <v-btn block color="primary" size="x-large" class="text-none"
                     :loading="regLoading" :disabled="!canRegister" @click="submitRegister">
                Create account
              </v-btn>
            </v-window-item>
          </v-window>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.opacity-80 { opacity: .8; }
@media (max-width: 600px){ .v-card { box-shadow: none !important; } }
</style>
