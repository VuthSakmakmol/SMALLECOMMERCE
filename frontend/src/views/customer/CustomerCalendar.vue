<!-- src/views/customer/CustomerCalendar.vue -->
<script setup>
import { ref, onMounted } from 'vue'
import api from '@/utils/api'

import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'

/* ───────── helpers ───────── */
const fmtDT = d => d ? new Date(d).toLocaleString([], { year:'numeric', month:'short', day:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'
const fmtT  = d => d ? new Date(d).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '—'
const readNotes = o => o?.notes ?? o?.note ?? o?.message ?? ''
const itemsLine = o => (o.items || []).map(it => `${it.qty || 1}× ${it.name || 'Item'}`).join(', ')

/* status → colors (used by CSS classes below) */
const STATUS = {
  PLACED:    'placed',
  ACCEPTED:  'accepted',
  COOKING:   'cooking',
  READY:     'ready',
  DELIVERED: 'delivered',
  CANCELED:  'canceled',
}
const statusKey = s => STATUS[String(s || '').toUpperCase()] || 'placed'

/* pre-order today & not delivered → urgent */
function ymd(d) { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()+1}-${x.getDate()}` }
function isPreorderTodayPending(o) {
  if (!o?.scheduledFor) return false
  const today = ymd(new Date())
  const sched = ymd(o.scheduledFor)
  const delivered = !!o.deliveredAt || String(o.status).toUpperCase() === 'DELIVERED'
  return (sched === today) && !delivered
}

/* event line content (HTML) */
function eventContent(info) {
  const o = info.event.extendedProps || {}
  const hasSched = !!o.scheduledFor
  const time = hasSched ? fmtT(o.scheduledFor) : ''
  const place = o.receivePlace ? ` <span class="ev-place">• 📍 ${o.receivePlace}</span>` : ''
  const note = readNotes(o) ? ' <span class="ev-note">📝</span>' : ''
  const html =
    `<div class="ev-line">
       ${time ? `<span class="ev-time">${time}</span> · ` : ''}
       <span class="ev-title">${itemsLine(o) || 'Order'}</span>${place}${note}
     </div>`
  return { html }
}

/* ───────── state & calendar options ───────── */
const loading = ref(false)
const calendarOptions = ref({
  plugins: [dayGridPlugin, interactionPlugin],
  initialView: 'dayGridMonth',
  headerToolbar: { left: 'today prev,next', center: 'title', right: '' },
  firstDay: 1,
  height: 'auto',
  expandRows: true,
  fixedWeekCount: false,
  aspectRatio: 1.35,
  dayMaxEventRows: 4,
  navLinks: false,
  dayHeaderFormat: { weekday: 'short' },
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },

  events: [],
  eventContent,
  eventClick: onEventClick,

  /* Beautiful UX touches */
  eventClassNames(arg) {
    const o = arg.event.extendedProps || {}
    const cls = [`st-${statusKey(o.status)}`]
    if (readNotes(o)) cls.push('has-notes')
    if (isPreorderTodayPending(o)) cls.push('urgent')
    return cls
  },
  eventDidMount(info) {
    const o = info.event.extendedProps || {}
    info.el.setAttribute('title', [
      o.scheduledFor ? `Time: ${fmtDT(o.scheduledFor)}` : 'No scheduled time',
      o.receivePlace ? `Place: ${o.receivePlace}` : null,
      itemsLine(o) ? `Items: ${itemsLine(o)}` : null,
      readNotes(o) ? `Notes: ${readNotes(o)}` : null,
      `Status: ${String(o.status || '').toUpperCase()}`
    ].filter(Boolean).join('\n'))
  },
})

/* fetch & map orders */
async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/orders', { params: { scope: 'CUSTOMER' } })
    const rows = Array.isArray(data) ? data : []

    calendarOptions.value.events = rows.map(o => {
      const hasSched = !!o.scheduledFor
      const when = hasSched ? new Date(o.scheduledFor) : new Date(o.createdAt || Date.now())
      return {
        id: o._id,
        title: itemsLine(o),
        start: when.toISOString(),
        allDay: !hasSched,
        extendedProps: { ...o },
      }
    })
  } finally {
    loading.value = false
  }
}

// class for mod chip (for prettier colors)
function modChipClass(m) {
  const kind = String(m?.kind).toUpperCase()
  const type = String(m?.type).toUpperCase()
  const val  = m?.value
  if (kind === 'INGREDIENT') {
    if (type === 'BOOLEAN') {
      const isFalse = (val === false) || (String(val).toLowerCase() === 'false') || (val === 0) || (String(val) === '0')
      if (isFalse) return 'chip-remove'
    }
    if (type === 'PERCENT' && Number(val) === 0) return 'chip-remove'
  }
  return 'chip-choice'
}

/* dialog */
const dialog = ref(false)
const current = ref(null)
function onEventClick(info) { current.value = info.event.extendedProps; dialog.value = true }

onMounted(load)
</script>

<template>
  <v-card class="rounded-2xl elevation-1">
    <v-toolbar color="primary" density="comfortable" class="rounded-t-2xl toolbar-glass">
      <v-toolbar-title class="font-weight-bold">Your Calendar</v-toolbar-title>
      <template #append>
        <v-btn class="mr-2" color="white" variant="flat" :loading="loading" @click="load">
          <v-icon start>mdi-refresh</v-icon> Refresh
        </v-btn>
      </template>
    </v-toolbar>

    <div class="pa-3 fc-theme">
      <FullCalendar :options="calendarOptions" />
    </div>

    <!-- Details dialog -->
    <v-dialog v-model="dialog" max-width="980">
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <div>Order Details</div>
          <div class="text-caption text-medium-emphasis">ID: {{ current?._id || '—' }}</div>
        </v-card-title>

        <v-card-subtitle class="px-4 pb-2">
          <v-chip v-if="current" :class="`chip-${statusKey(current.status)}`" size="small" label>
            {{ String(current.status || '').toUpperCase() }}
          </v-chip>
          <v-chip
            v-if="current && isPreorderTodayPending(current)"
            color="error"
            size="small"
            label
            class="ml-2"
          >
            PRE-ORDER TODAY
          </v-chip>
        </v-card-subtitle>

        <v-card-text v-if="current" class="pt-0">
          <v-row dense class="mb-3">
            <v-col cols="12" md="6">
              <v-sheet class="pa-3 rounded-xl soft-card">
                <div class="text-subtitle-2 font-weight-medium mb-1">Placed</div>
                <div>{{ fmtDT(current.createdAt) }}</div>
                <div class="text-caption text-medium-emphasis mt-1">
                  Updated {{ fmtDT(current.updatedAt) }}
                </div>
              </v-sheet>
            </v-col>
            <v-col cols="12" md="6">
              <v-sheet class="pa-3 rounded-xl soft-card">
                <div class="text-subtitle-2 font-weight-medium mb-1">Pre-Order</div>
                <div><strong>Time:</strong> {{ fmtDT(current.scheduledFor) }}</div>
                <div><strong>Place:</strong> {{ current.receivePlace || '—' }}</div>
              </v-sheet>
            </v-col>
          </v-row>

          <div v-if="readNotes(current)" class="mb-3">
            <div class="text-subtitle-2 mb-1">Notes</div>
            <v-alert type="info" variant="tonal" border="start" border-color="primary" class="rounded-xl">
              {{ readNotes(current) }}
            </v-alert>
          </div>

          <div class="text-subtitle-2 mb-2">Items</div>
          <v-table density="comfortable" class="rounded-xl mb-4 soft-table">
            <thead>
              <tr>
                <th style="width:90px">Image</th>
                <th>Item</th>
                <th style="width:80px">Qty</th>
                <th style="width:260px">Ingredients</th>
                <th style="width:260px">Choices</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(it, idx) in (current.items || [])" :key="idx">
                <td>
                  <v-img v-if="it.imageUrl" :src="it.imageUrl" width="64" height="48" class="rounded-lg" cover />
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
                <td>{{ it.name || 'Item' }}</td>
                <td>×{{ it.qty || 1 }}</td>

                <!-- Ingredients -->
                <td>
                  <div v-if="(it.ingredients||[]).length" class="d-flex flex-wrap ga-1">
                    <v-chip
                      v-for="(ing,k) in it.ingredients"
                      :key="k"
                      size="x-small"
                      :class="ing.included === false ? 'chip-remove' : 'chip-ok'"
                      variant="tonal"
                    >
                      {{ ing.name || 'Ingredient' }}
                      <template v-if="ing.value !== null && ing.value !== undefined">: {{ ing.value }}</template>
                      <template v-else> ({{ ing.included === false ? 'removed' : 'included' }})</template>
                    </v-chip>
                  </div>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>

                <!-- Mods / Choices (red if removed) -->
                <td>
                  <div v-if="(it.mods||[]).length" class="d-flex flex-wrap ga-1">
                    <v-chip
                      v-for="(m,k) in it.mods"
                      :key="k"
                      size="x-small"
                      :class="modChipClass(m)"
                      variant="tonal"
                    >
                      <template v-if="String(m.kind).toUpperCase() === 'INGREDIENT'">
                        {{ m.label || 'Ingredient' }}:
                        <template v-if="String(m.type).toUpperCase() === 'BOOLEAN'">
                          {{
                            (m.value && String(m.value).toLowerCase() !== 'false' && String(m.value) !== '0')
                              ? 'Included'
                              : 'Removed'
                          }}
                        </template>
                        <template v-else-if="String(m.type).toUpperCase() === 'PERCENT'">
                          {{ Number(m.value) }}%
                        </template>
                        <template v-else>{{ m.value }}</template>
                      </template>
                      <template v-else-if="String(m.kind).toUpperCase() === 'GROUP'">
                        {{ m.label || 'Choice' }}: {{ m.value }}
                      </template>
                      <template v-else>
                        {{ m.label || 'Option' }}: {{ m.value }}
                      </template>
                    </v-chip>
                  </div>
                  <span v-else class="text-medium-emphasis">—</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn variant="tonal" color="primary" class="rounded-xl" @click="dialog=false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
/* ---------- Theme tokens (easy to tweak) ---------- */
:root {
  --c-placed:    214, 82%, 46%;
  --c-accepted:  196, 98%, 40%;
  --c-cooking:   31,  96%, 54%;
  --c-ready:     142, 39%, 40%;
  --c-delivered: 200, 14%, 45%;
  --c-canceled:  0,   81%, 57%;
  --c-text-on-dark: #fff;
}

/* ---------- Toolbar polish ---------- */
.toolbar-glass {
  backdrop-filter: saturate(120%) blur(6px);
}
.fc-theme :deep(.fc .fc-button) {
  padding: 6px 10px;
  border-radius: 10px;
  box-shadow: none;
  border: none;
}
.fc-theme :deep(.fc .fc-button-primary) {
  background: rgba(255,255,255,.2);
}
.fc-theme :deep(.fc .fc-button-primary:hover) {
  background: rgba(255,255,255,.3);
}

/* ---------- Grid polish ---------- */
.fc-theme :deep(.fc) { --fc-border-color: rgba(127,127,127,0.18); }
.fc-theme :deep(.fc-toolbar-title) { font-weight: 800; letter-spacing: .2px; }
.fc-theme :deep(.fc-daygrid-day-number) { padding: 8px 10px; font-weight: 700; }
.fc-theme :deep(.fc-day-today) { background: rgba(25,118,210,.12); outline: 2px solid rgba(25,118,210,.35); outline-offset: -2px; border-radius: 12px; }
.fc-theme :deep(.fc-daygrid-day) { transition: background .2s ease; border-radius: 12px; }
.fc-theme :deep(.fc-daygrid-day:hover) { background: rgba(0,0,0,.03); }

/* ---------- Events: gradients, shadow, hover ---------- */
.fc-theme :deep(.fc-event) {
  border: none;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,.08);
  transition: transform .12s ease, box-shadow .12s ease, filter .12s ease;
  color: var(--c-text-on-dark);
}
.fc-theme :deep(.fc-event:hover) {
  transform: translateY(-1px);
  box-shadow: 0 6px 18px rgba(0,0,0,.15);
  filter: brightness(1.03);
}

/* Status color classes (nice soft gradients) */
.fc-theme :deep(.st-placed)   { background: linear-gradient(135deg, hsl(var(--c-placed)) 0%, hsl(var(--c-placed) / .88) 100%); }
.fc-theme :deep(.st-accepted) { background: linear-gradient(135deg, hsl(var(--c-accepted)) 0%, hsl(var(--c-accepted) / .88) 100%); }
.fc-theme :deep(.st-cooking)  { background: linear-gradient(135deg, hsl(var(--c-cooking)) 0%, hsl(var(--c-cooking) / .88) 100%); }
.fc-theme :deep(.st-ready)   { background: linear-gradient(135deg, hsl(var(--c-ready)) 0%, hsl(var(--c-ready) / .88) 100%); }
.fc-theme :deep(.st-delivered){ background: linear-gradient(135deg, hsl(var(--c-delivered)) 0%, hsl(var(--c-delivered) / .88) 100%); }
.fc-theme :deep(.st-canceled) { background: linear-gradient(135deg, hsl(var(--c-canceled)) 0%, hsl(var(--c-canceled) / .88) 100%); }

/* Urgent: pre-order today + not delivered → pulsing red */
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(198, 33, 30, 0.5); }
  70% { box-shadow: 0 0 0 10px rgba(229,57,53,0); }
  100% { box-shadow: 0 0 0 0 rgba(229,57,53,0); }
}
.fc-theme :deep(.urgent) {
  background: linear-gradient(135deg, hsl(var(--c-canceled)) 0%, hsl(var(--c-canceled) / .88) 100%);
  color: #361f1f;
  animation: pulse 1.7s ease-out infinite;
}

/* Event line text */
.fc-theme :deep(.ev-line){ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.fc-theme :deep(.ev-time){ font-weight:800; margin-right: 2px; }

/* Notes corner badge */
.fc-theme :deep(.has-notes) {
  position: relative;
}
.fc-theme :deep(.has-notes::after) {
  content: "";
  position: absolute;
  top: -8px; right: -8px;
  font-size: 12px;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,.3));
}

/* Dialog cosmetics */
.soft-card { background: rgba(0,0,0,.035); border: 1px solid rgba(127,127,127,.18); }
.soft-table thead tr { background: rgba(0,0,0,.035); }
.chip-ok     { background: rgba(46,125,50,.12) !important; color: #2E7D32 !important; }
.chip-remove { background: rgba(229,57,53,.12) !important; color: #ef0501 !important; }
.chip-choice { background: rgba(25,118,210,.12) !important; color: #072d52 !important; }

/* Chips for status in dialog (match gradients subtly) */
.chip-placed    { background: hsl(var(--c-placed) / .15) !important; color: hsl(var(--c-placed)) !important; }
.chip-accepted  { background: hsl(var(--c-accepted) / .15) !important; color: hsl(var(--c-accepted)) !important; }
.chip-cooking   { background: hsl(var(--c-cooking) / .15) !important; color: hsl(var(--c-cooking)) !important; }
.chip-ready     { background: hsl(var(--c-ready) / .15) !important; color: hsl(var(--c-ready)) !important; }
.chip-delivered { background: hsl(var(--c-delivered) / .15) !important; color: hsl(var(--c-delivered)) !important; }
.chip-canceled  { background: hsl(var(--c-canceled) / .15) !important; color: hsl(var(--c-canceled)) !important; }
</style>
