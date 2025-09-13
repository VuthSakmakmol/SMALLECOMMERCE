<script setup>
import { ref, computed } from 'vue'
import api from '@/utils/api'
import { useCart } from '@/store/cart'

/* ------- props / emits ------- */
const props = defineProps({ modelValue: { type: Boolean, default: false } })
const emit  = defineEmits(['update:modelValue','place'])

const open = computed({
  get: () => props.modelValue,
  set: v => emit('update:modelValue', v)
})

/* ------- store ------- */
const cart = useCart()
const count = computed(() => cart.count)
const items = computed(() => cart.items)

/* Suggested places (editable). Change to v-combobox if you want free typing + chips */
const placeOptions = [
  'Apsara meeting Room',
  'adidas meeting Room',
  'Angkor meeting Room',
  'Dark room',
  'HR Office',
  'Shipping Office',
  'Reception Desk'
]

/* ------- customize dialog state ------- */
const editing = ref(null)        // cart item object
const foodDef = ref(null)        // GET /foods/:id populated
const custom  = ref({            // working copy
  ingredients: [],               // [{ ingredientId, included, value }]
  groups: []                     // [{ groupId, choice }]
})
const tab     = ref('ings')
const loading = ref(false)

/* dialog v-model wrapper (writable) */
function closeDialog () {
  editing.value = null
  foodDef.value = null
  custom.value = { ingredients: [], groups: [] }
  tab.value = 'ings'
}
const dialogOpen = computed({
  get: () => !!editing.value,
  set: v => { if (!v) closeDialog() }
})

/* ------- helpers ------- */
function inc (it)    { cart.inc(it) }
function dec (it)    { cart.dec(it) }
function remove (it) { cart.remove(it) }
function clear ()    { cart.clear() }

/* Fetch food + seed working copy from current item selections */
async function openCustomize (item) {
  if (item.kind !== 'FOOD') return
  loading.value = true
  try {
    const { data } = await api.get(`/foods/${item.id}`) // populated with attachments
    foodDef.value = data

    const ingMap   = new Map((item.ingredients || []).map(i => [String(i.ingredientId), i]))
    const groupMap = new Map((item.groups || []).map(g => [String(g.groupId), g]))

    const ings = (data.ingredients || []).map(att => {
      const id  = att.ingredientId?._id || att.ingredientId
      const sel = ingMap.get(String(id)) || {}
      return {
        ingredientId: id,
        included: sel.included ?? !!att.defaultIncluded,
        value: sel.value ?? att.defaultValue ?? att.ingredientId?.defaultValue ?? null
      }
    })
    const grps = (data.choiceGroups || []).map(att => {
      const id  = att.groupId?._id || att.groupId
      const sel = groupMap.get(String(id)) || {}
      return {
        groupId: id,
        choice: sel.choice ?? (att.defaultChoice ?? null)
      }
    })

    custom.value = { ingredients: ings, groups: grps }
    editing.value = item
    tab.value = 'ings'
  } finally { loading.value = false }
}

/* lookups for rendering */
function ingDef (ingredientId) {
  const x = (foodDef.value?.ingredients || []).find(a => {
    const id = a.ingredientId?._id || a.ingredientId
    return id === ingredientId
  })
  return x ? { attach: x, def: x.ingredientId } : null
}
function grpDef (groupId) {
  const x = (foodDef.value?.choiceGroups || []).find(a => {
    const id = a.groupId?._id || a.groupId
    return id === groupId
  })
  return x ? { attach: x, def: x.groupId } : null
}

/* persist selections back to cart item (WITH DEFAULTS for later diff) */
function saveCustomize () {
  if (!editing.value) return

  // helper: label for a choice value within a group
  const choiceLabelOf = (groupId, value) => {
    const grp = (foodDef.value?.choiceGroups || []).find(a => {
      const id = a.groupId?._id || a.groupId
      return String(id) === String(groupId)
    })
    const choices = grp?.groupId?.choices || grp?.choices || []
    const m = choices.find(c => String(c.value) === String(value))
    return m?.label ?? null
  }

  // INGREDIENTS: store selection + DEFAULTS + TYPE (for later diff)
  const ings = custom.value.ingredients.map(sel => {
    const att = (foodDef.value?.ingredients || []).find(a => {
      const id = a.ingredientId?._id || a.ingredientId
      return String(id) === String(sel.ingredientId)
    })
    const def  = att?.ingredientId
    return {
      ingredientId: sel.ingredientId,
      included: !!sel.included,
      value: sel.value ?? null,
      name: def?.name || null,

      // defaults to compute diff at submit
      _type: (def?.type || 'BOOLEAN').toUpperCase(),
      _defaultIncluded: !!att?.defaultIncluded,
      _defaultValue: att?.defaultValue ?? def?.defaultValue ?? null,
    }
  })

  // GROUPS: store selection + DEFAULT (for later diff)
  const grps = custom.value.groups.map(g => {
    const att = (foodDef.value?.choiceGroups || []).find(a => {
      const id = a.groupId?._id || a.groupId
      return String(id) === String(g.groupId)
    })
    return {
      groupId: g.groupId,
      choice: g.choice ?? null,
      choiceLabel: g.choice != null ? choiceLabelOf(g.groupId, g.choice) : null,

      _defaultChoice: att?.defaultChoice ?? null,
      _required: !!att?.groupId?.required || !!att?.required,
    }
  })

  cart.updateItem(editing.value.key, { ingredients: ings, groups: grps })
  closeDialog()
}
</script>

<template>
  <!-- Drawer -->
  <v-navigation-drawer v-model="open" location="right" temporary width="460">
    <v-toolbar flat>
      <v-toolbar-title>Cart ({{ count }})</v-toolbar-title>
      <v-spacer />
      <v-btn icon @click="open=false"><v-icon>mdi-close</v-icon></v-btn>
    </v-toolbar>

    <div class="pa-3">
      <!-- Items list -->
      <v-list density="comfortable">
        <v-list-item v-for="it in items" :key="it.key" class="rounded-lg">
          <template #prepend>
            <v-chip size="x-small" class="mr-2" :color="it.kind==='PACKAGE' ? 'purple' : 'primary'">
              {{ it.kind }}
            </v-chip>
          </template>

          <v-list-item-title class="font-weight-medium">{{ it.name }}</v-list-item-title>

          <v-list-item-subtitle v-if="it.kind==='FOOD'">
            <span class="text-caption text-medium-emphasis">
              <template v-if="(it.ingredients?.length||0) + (it.groups?.length||0) === 0">No customizations</template>
              <template v-else>
                {{ (it.ingredients || []).filter(x => x.included).length }} ings,
                {{ it.groups?.length || 0 }} choices
              </template>
            </span>
          </v-list-item-subtitle>

          <template #append>
            <div class="d-flex align-center ga-2">
              <v-btn
                v-if="it.kind==='FOOD'"
                size="x-small"
                variant="tonal"
                color="secondary"
                @click.stop="openCustomize(it)"
              >
                <v-icon start>mdi-tune</v-icon> Edit
              </v-btn>

              <v-btn icon size="x-small" variant="tonal" @click="dec(it)">
                <v-icon>mdi-minus</v-icon>
              </v-btn>
              <div class="text-subtitle-2" style="min-width:24px;text-align:center">{{ it.qty }}</div>
              <v-btn icon size="x-small" variant="tonal" @click="inc(it)">
                <v-icon>mdi-plus</v-icon>
              </v-btn>

              <v-btn icon size="x-small" variant="text" color="red" @click="remove(it)">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </template>
        </v-list-item>

        <v-list-item v-if="!items.length">
          <v-list-item-title class="text-medium-emphasis">Your cart is empty.</v-list-item-title>
        </v-list-item>
      </v-list>

      <v-divider class="my-3" />

      
      <div class="mb-3">
        <v-textarea
          v-model="cart.notes"
          label="Notes for kitchen / delivery"
          auto-grow
          variant="outlined"
          rows="2"
          density="compact"
          hide-details="auto"
          placeholder="E.g. no chili, extra sauce, deliver to 2nd floor"
        />
      </div>

      <!-- Pre-Order inside the cart -->
      <div class="mb-3">
        <div class="text-subtitle-2 mb-2">Pre-Order</div>
        <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="cart.scheduledDate"
              type="date"
              label="Date"
              density="compact"
              variant="outlined"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field
              v-model="cart.scheduledTime"
              type="time"
              label="Time"
              variant="outlined"
              density="compact"
              hide-details="auto"
            />
          </v-col>
          <v-col cols="12">
            <v-select
              v-model="cart.receivePlace"
              :items="placeOptions"
              label="Receive at"
              variant="outlined"
              density="compact"
              clearable
              hide-details="auto"
            />
            <!-- If you want free typing, replace v-select with v-combobox -->
            <!--
            <v-combobox
              v-model="cart.receivePlace"
              :items="placeOptions"
              label="Receive at"
              density="compact"
              clearable
              hide-details="auto"
            />
            -->
          </v-col>
        </v-row>
        <div class="text-caption text-medium-emphasis">
          We’ll prepare your order for the selected date & time.
        </div>
      </div>

      <v-divider class="my-3" />

      <div class="d-flex justify-space-between">
        <v-btn variant="text" color="grey" @click="clear" :disabled="!items.length">
          <v-icon start>mdi-broom</v-icon> Clear
        </v-btn>
        <v-btn color="primary" :disabled="!items.length" @click="emit('place')">
          <v-icon start>mdi-check</v-icon> Place order
        </v-btn>
      </div>
    </div>
  </v-navigation-drawer>

  <!-- Customize Dialog -->
  <v-dialog v-model="dialogOpen" max-width="760" persistent>
    <v-card :loading="loading">
      <v-card-title>
        Customize: {{ editing?.name }}
      </v-card-title>
      <v-card-text>
        <v-tabs v-model="tab" class="mb-2">
          <v-tab value="ings">Ingredients</v-tab>
          <v-tab value="groups">Choices</v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <!-- INGREDIENTS -->
          <v-window-item value="ings">
            <v-table density="comfortable" class="rounded-lg">
              <thead>
                <tr>
                  <th style="width:34%">Ingredient</th>
                  <th style="width:12%">Include</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="sel in custom.ingredients" :key="sel.ingredientId">
                  <td>
                    {{ ingDef(sel.ingredientId)?.def?.name }}
                    <small class="text-medium-emphasis">
                      ({{ ingDef(sel.ingredientId)?.def?.type }})
                    </small>
                  </td>

                  <td class="text-center">
                    <v-switch
                      v-model="sel.included"
                      inset hide-details
                      :disabled="
                        ingDef(sel.ingredientId)?.attach?.defaultIncluded &&
                        ingDef(sel.ingredientId)?.attach?.removable === false
                      "
                    />
                  </td>

                  <td>
                    <!-- PERCENT -->
                    <template v-if="ingDef(sel.ingredientId)?.def?.type === 'PERCENT'">
                      <div class="d-flex ga-2">
                        <v-text-field
                          v-model.number="sel.value"
                          type="number"
                          density="compact"
                          label="%"
                          :min="ingDef(sel.ingredientId)?.def?.min ?? 0"
                          :max="ingDef(sel.ingredientId)?.def?.max ?? 100"
                          :step="ingDef(sel.ingredientId)?.def?.step ?? 25"
                          :disabled="!sel.included"
                        />
                      </div>
                    </template>

                    <!-- CHOICE -->
                    <template v-else-if="ingDef(sel.ingredientId)?.def?.type === 'CHOICE'">
                      <v-select
                        :items="(ingDef(sel.ingredientId)?.def?.choices || [])
                                  .map(c => ({ title:c.label, value:c.value }))"
                        v-model="sel.value"
                        label="Choice"
                        density="compact"
                        :disabled="!sel.included"
                      />
                    </template>

                    <!-- BOOLEAN -->
                    <template v-else>
                      <span class="text-medium-emphasis">Boolean (no extra value)</span>
                    </template>
                  </td>
                </tr>

                <tr v-if="custom.ingredients.length===0">
                  <td colspan="3" class="text-center text-medium-emphasis">
                    No attachable ingredients.
                  </td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>

          <!-- CHOICE GROUPS -->
          <v-window-item value="groups">
            <v-table density="comfortable" class="rounded-lg">
              <thead>
                <tr>
                  <th style="width:35%">Group</th>
                  <th>Choice</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="g in custom.groups" :key="g.groupId">
                  <td>{{ grpDef(g.groupId)?.def?.name }}</td>
                  <td>
                    <v-select
                      :items="(grpDef(g.groupId)?.def?.choices || [])
                                .map(c => ({ title:c.label, value:c.value }))"
                      v-model="g.choice"
                      label="Choice"
                      density="compact"
                    />
                  </td>
                </tr>

                <tr v-if="custom.groups.length===0">
                  <td colspan="2" class="text-center text-medium-emphasis">No choice groups.</td>
                </tr>
              </tbody>
            </v-table>
          </v-window-item>
        </v-window>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="closeDialog">Cancel</v-btn>
        <v-btn color="primary" @click="saveCustomize">
          <v-icon start>mdi-content-save</v-icon> Save
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
