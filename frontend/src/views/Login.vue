<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/store/auth'

const router = useRouter()
const auth = useAuth()

const email = ref('')
const password = ref('')
const showPw = ref(false)

const rules = {
  required: v => !!String(v || '').trim() || 'Required',
  email: v => /.+@.+\..+/.test(String(v || '')) || 'Invalid email',
}

const submit = async () => {
  const ok = await auth.login(email.value, password.value)
  if (!ok) return

  if (auth.role === 'ADMIN') router.push('/admin')
  else if (auth.role === 'CHEF') router.push('/chef')
  else router.push('/customer')
}
</script>

<template>
  <v-container fluid class="fill-height pa-0">
    <v-row no-gutters class="fill-height">
      <!-- Left side: Full gradient -->
      <v-col
        cols="12" md="6"
        class="d-flex flex-column align-center justify-center text-white"
        style="background: linear-gradient(135deg, #FF6B35, #FFB347); min-height: 100vh;"
      >
        <v-icon size="100" color="white" class="mb-4">mdi-silverware-fork-knife</v-icon>
        <h1 class="text-h3 font-weight-bold mb-2">Food Chef</h1>
        <p class="text-body-1 opacity-80">Delicious food, managed with style.</p>
      </v-col>

      <!-- Right side: Centered login -->
      <v-col
        cols="12" md="6"
        class="d-flex align-center justify-center"
        style="min-height: 100vh;"
      >
        <v-card
          class="pa-10 rounded-xl elevation-3"
          max-width="480"
          width="100%"
        >
          <div class="text-center mb-8">
            <v-icon size="60" color="primary" class="mb-2">mdi-account-circle</v-icon>
            <div class="text-h5 font-weight-bold">Sign in to continue</div>
          </div>

          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="mdi-email-outline"
            :rules="[rules.required, rules.email]"
            @keyup.enter="submit"
          />
          <v-text-field
            v-model="password"
            :type="showPw ? 'text' : 'password'"
            label="Password"
            variant="outlined"
            density="comfortable"
            prepend-inner-icon="mdi-lock-outline"
            :append-inner-icon="showPw ? 'mdi-eye-off-outline' : 'mdi-eye-outline'"
            @click:append-inner="showPw = !showPw"
            :rules="[rules.required]"
            @keyup.enter="submit"
          />

          <v-alert
            v-if="auth.error"
            type="error"
            variant="tonal"
            class="mb-4"
            density="comfortable"
          >
            {{ auth.error }}
          </v-alert>

          <v-btn
            block
            color="primary"
            size="x-large"
            class="text-none"
            :loading="auth.loading"
            @click="submit"
          >
            Sign in
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.opacity-80 { opacity: 0.8; }
</style>
