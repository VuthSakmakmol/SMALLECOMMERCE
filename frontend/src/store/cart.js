// src/store/cart.js
import { defineStore } from 'pinia'

export const useCart = defineStore('cart', {
  state: () => ({
    items: [], // [{ kind:'FOOD'|'PACKAGE', id, name, qty, price }]
    orderType: 'INDIVIDUAL', // 'INDIVIDUAL' | 'GROUP' | 'WORKSHOP'
    groupKey: '',            // used when orderType === 'GROUP'
    notes: ''                // optional notes
  }),
  getters: {
    count: (s) => s.items.reduce((a, b) => a + b.qty, 0),
    total: (s) => s.items.reduce((a, b) => a + (Number(b.price || 0) * b.qty), 0),
    hasItems: (s) => s.items.length > 0
  },
  actions: {
    _key(kind, id) { return `${kind}:${id}` },
    addFood(food, qty = 1) {
      const k = this._key('FOOD', food._id)
      const found = this.items.find(i => i.key === k)
      const name = food.name || 'Food'
      // Food has no price in your schema -> 0
      const price = Number(food.price || 0)
      if (found) found.qty += qty
      else this.items.push({ key: k, kind: 'FOOD', id: food._id, name, qty, price })
    },
    addPackage(pkg, qty = 1) {
      const k = this._key('PACKAGE', pkg._id)
      const found = this.items.find(i => i.key === k)
      const name = pkg.name || 'Package'
      const price = Number(pkg.price || 0)
      if (found) found.qty += qty
      else this.items.push({ key: k, kind: 'PACKAGE', id: pkg._id, name, qty, price })
    },
    inc(item) { item.qty++ },
    dec(item) { item.qty > 1 ? item.qty-- : (this.items = this.items.filter(i => i !== item)) },
    remove(item) { this.items = this.items.filter(i => i !== item) },
    clear() { this.items = []; this.notes = ''; this.groupKey = ''; this.orderType = 'INDIVIDUAL' }
  }
})
