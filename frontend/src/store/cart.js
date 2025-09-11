// src/store/cart.js
import { defineStore } from 'pinia'

const ORDER = {
  INDIVIDUAL: 'INDIVIDUAL',
  GROUP: 'GROUP',
  WORKSHOP: 'WORKSHOP',
}

export const useCart = defineStore('cart', {
  state: () => ({
    // items: [{
    //   key, kind:'FOOD'|'PACKAGE', id, name, qty,
    //   imageUrl?, stockQty?,
    //   ingredients: [{ ingredientId, included, value }],
    //   groups:      [{ groupId, choice }]
    // }]
    items: [],
    orderType: ORDER.INDIVIDUAL,
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
      const v = food?.stockQty
      return (v === null || v === undefined) ? null : Number(v)
    },

    _allowedAddQtyForFood(food, wantAdd = 1) {
      const k = this._key('FOOD', food._id)
      const current = this.items.find(i => i.key === k)?.qty || 0
      const stock = this._capFoodQtySnapshot(food)
      if (stock === null) return wantAdd
      const room = Math.max(0, stock - current)
      return Math.min(room, Math.max(1, Number(wantAdd) || 1))
    },

    /* ---------- order-type constraints ---------- */
    _violatesTypeOnAdd(kind) {
      if (this.orderType === ORDER.INDIVIDUAL && kind === 'PACKAGE') return true
      if (this.orderType === ORDER.WORKSHOP && kind === 'FOOD') return true
      return false
    },

    setOrderType(next) {
      const type = String(next || '').toUpperCase()
      if (![ORDER.INDIVIDUAL, ORDER.GROUP, ORDER.WORKSHOP].includes(type)) return false
      if (type === ORDER.INDIVIDUAL && this.hasPackages) return false
      if (type === ORDER.WORKSHOP && this.hasFoods) return false
      this.orderType = type
      if (this.orderType !== ORDER.GROUP) this.groupKey = ''
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
          // customization containers expected by Cart.vue
          ingredients: [],
          groups: []
        })
      }
      return { ok: true, added: allowed }
    },

    // Packages assumed unlimited stock
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
      } else {
        this.items.push({
          key: k,
          kind: 'PACKAGE',
          id: pkg._id,
          name: pkg.name,
          qty: addN,
          imageUrl: pkg.imageUrl || '',
          // keep consistent shape though packages might not use them
          ingredients: [],
          groups: []
        })
      }
      return { ok: true, added: addN }
    },

    inc(it) {
      if (!it) return
      if (it.kind === 'FOOD') {
        const cap = it.stockQty ?? null
        if (cap === null || it.qty < cap) it.qty++
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

    /* ---------- used by Customize dialog ---------- */
    getItemIndex(target) {
      if (!target) return -1
      if (typeof target === 'string') return this.items.findIndex(i => i.key === target)
      if (target.key) return this.items.findIndex(i => i.key === target.key)
      if (target.kind && target.id) return this.items.findIndex(i => i.key === this._key(target.kind, target.id))
      return -1
    },

    /** Patch an item by key or object (Cart.vue calls updateItem(key, patch)) */
    updateItem(target, patch = {}) {
      const idx = this.getItemIndex(target)
      if (idx === -1) return { ok: false, reason: 'not_found' }

      const old = this.items[idx]
      // Ensure ingredients/groups exist even if omitted in patch
      const next = {
        ...old,
        ...patch,
        ingredients: patch.ingredients ?? old.ingredients ?? [],
        groups: patch.groups ?? old.groups ?? []
      }

      this.items[idx] = next
      return { ok: true, item: next }
    },
  }
})
