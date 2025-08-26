<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/store/auth'
const email = ref('admin@example.com')
const password = ref('admin123')
const auth = useAuth()
const router = useRouter()

const submit = async () => {
  const ok = await auth.login(email.value, password.value)
  if (!ok) return
  if (auth.role === 'ADMIN') router.push('/admin')
  else if (auth.role === 'CHEF') router.push('/chef')      
  else router.push('/customer')                        
}

</script>


<template>
  <v-card class="mx-auto" max-width="420">
    <v-card-title>Login</v-card-title>
    <v-card-text>
      <v-text-field v-model="email" label="Email" />
      <v-text-field v-model="password" label="Password" type="password" />
      <v-alert v-if="auth.error" type="error" variant="tonal" class="mt-2">{{ auth.error }}</v-alert>
    </v-card-text>
    <v-card-actions>
      <v-btn :loading="auth.loading" block color="primary" @click="submit">Sign in</v-btn>
    </v-card-actions>
  </v-card>
</template>
