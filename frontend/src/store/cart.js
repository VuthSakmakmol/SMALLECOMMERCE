// src/store/cart.js
import { defineStore } from 'pinia'

const ORDER = {
  INDIVIDUAL: 'INDIVIDUAL',
  GROUP: 'GROUP',
  WORKSHOP: 'WORKSHOP',
}

export const useCart = defineStore('cart', {
  state: () => ({
    // items: [{ key, kind:'FOOD'|'PACKAGE', id, name, qty, imageUrl?, items?, stockQty? }]
    items: [],
    orderType: ORDER.INDIVIDUAL, // 'INDIVIDUAL' | 'GROUP' | 'WORKSHOP'
    groupKey: '',
    notes: '',
  }),

  getters: {
    count: s => s.items.reduce((a, b) => a + Number(b.qty || 0), 0),
    hasItems: s => s.items.length > 0,
    hasFoods: s => s.items.some(i => i.kind === 'FOOD'),
    hasPackages: s => s.items.some(i => i.kind === 'PACKAGE'),
  },

  actions: {
    _key(kind, id) { return `${kind}:${id}` },

    /* ---------- stock helpers ---------- */
    _capFoodQtySnapshot(food) {
      // snapshot current stock to item (null = unlimited)
      const v = food?.stockQty
      return (v === null || v === undefined) ? null : Number(v)
    },

    _allowedAddQtyForFood(food, wantAdd = 1) {
      const k = this._key('FOOD', food._id)
      const current = this.items.find(i => i.key === k)?.qty || 0
      const stock = this._capFoodQtySnapshot(food)
      if (stock === null) return wantAdd // unlimited
      const room = Math.max(0, stock - current)
      return Math.min(room, Math.max(1, Number(wantAdd) || 1))
    },

    /* ---------- order-type constraints (from your flow) ----------
       - INDIVIDUAL: foods only (no packages)
       - WORKSHOP:   packages only (no foods)
       - GROUP:      can mix
    -------------------------------------------------------------- */
    _violatesTypeOnAdd(kind) {
      if (this.orderType === ORDER.INDIVIDUAL && kind === 'PACKAGE') return true
      if (this.orderType === ORDER.WORKSHOP && kind === 'FOOD') return true
      return false
    },

    setOrderType(next) {
      const type = String(next || '').toUpperCase()
      if (![ORDER.INDIVIDUAL, ORDER.GROUP, ORDER.WORKSHOP].includes(type)) return false

      // Prevent switching to a mode that conflicts with current cart contents
      if (type === ORDER.INDIVIDUAL && this.hasPackages) return false
      if (type === ORDER.WORKSHOP && this.hasFoods) return false

      this.orderType = type
      if (this.orderType !== ORDER.GROUP) this.groupKey = '' // only GROUP can carry a key
      return true
    },

    validateBeforeSubmit() {
      if (!this.hasItems) return { ok: false, reason: 'empty' }
      if (this.orderType === ORDER.INDIVIDUAL && this.hasPackages)
        return { ok: false, reason: 'individual_requires_food_only' }
      if (this.orderType === ORDER.WORKSHOP && this.hasFoods)
        return { ok: false, reason: 'workshop_requires_packages_only' }
      if (this.orderType === ORDER.INDIVIDUAL && !this.hasFoods)
        return { ok: false, reason: 'individual_needs_food' }
      if (this.orderType === ORDER.WORKSHOP && !this.hasPackages)
        return { ok: false, reason: 'workshop_needs_package' }
      // GROUP has no extra constraints
      return { ok: true }
    },

    /* ---------- add / edit items ---------- */
    addFood(food, qty = 1) {
      if (!food?._id) return { ok: false, reason: 'invalid_food' }
      if (this._violatesTypeOnAdd('FOOD')) return { ok: false, reason: 'type_conflict' }

      const allowed = this._allowedAddQtyForFood(food, qty)
      if (allowed <= 0) return { ok: false, reason: 'no_stock' }

      const k = this._key('FOOD', food._id)
      const found = this.items.find(i => i.key === k)
      if (found) {
        found.qty += allowed
        // keep the freshest snapshot of stock
        found.stockQty = this._capFoodQtySnapshot(food)
        found.imageUrl = food.imageUrl || found.imageUrl || ''
        found.name = food.name || found.name
      } else {
        this.items.push({
          key: k,
          kind: 'FOOD',
          id: food._id,
          name: food.name,
          qty: allowed,
          imageUrl: food.imageUrl || '',
          stockQty: this._capFoodQtySnapshot(food),
        })
      }
      return { ok: true, added: allowed }
    },

    // Store package contents so UI can show them; packages assumed unlimited (no stockQty)
    addPackage(pkg, qty = 1) {
      if (!pkg?._id) return { ok: false, reason: 'invalid_package' }
      if (this._violatesTypeOnAdd('PACKAGE')) return { ok: false, reason: 'type_conflict' }

      const addN = Math.max(1, Number(qty) || 1)
      const k = this._key('PACKAGE', pkg._id)
      const found = this.items.find(i => i.key === k)
      if (found) {
        found.qty += addN
        found.imageUrl = pkg.imageUrl || found.imageUrl || ''
        found.name = pkg.name || found.name
        if (Array.isArray(pkg.items)) found.items = pkg.items.map(it => ({ foodId: it.foodId, qty: it.qty }))
      } else {
        this.items.push({
          key: k,
          kind: 'PACKAGE',
          id: pkg._id,
          name: pkg.name,
          qty: addN,
          items: Array.isArray(pkg.items) ? pkg.items.map(it => ({ foodId: it.foodId, qty: it.qty })) : [],
          imageUrl: pkg.imageUrl || '',
        })
      }
      return { ok: true, added: addN }
    },

    inc(it) {
      if (!it) return
      if (it.kind === 'FOOD') {
        const cap = it.stockQty ?? null
        if (cap === null || it.qty < cap) it.qty++
        // else: hit cap, no-op
      } else {
        it.qty++
      }
    },

    dec(it) {
      if (!it) return
      if (it.qty > 1) it.qty--
      else this.items = this.items.filter(x => x !== it)
    },

    setQty(it, nextQty) {
      if (!it) return
      let n = Math.max(1, parseInt(nextQty, 10) || 1)
      if (it.kind === 'FOOD' && it.stockQty != null) n = Math.min(n, Number(it.stockQty))
      it.qty = n
    },

    remove(it) { this.items = this.items.filter(x => x !== it) },

    clear() {
      this.items = []
      this.notes = ''
      this.groupKey = ''
      this.orderType = ORDER.INDIVIDUAL
    },
  }
})
