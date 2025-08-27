// store/cart.js
import { defineStore } from 'pinia'

export const useCart = defineStore('cart', {
  state: () => ({
    items: [], // [{ key, kind:'FOOD'|'PACKAGE', id, name, qty, items?[{foodId,qty}], imageUrl? }]
    orderType: 'INDIVIDUAL', // 'INDIVIDUAL' | 'GROUP' | 'WORKSHOP'
    groupKey: '',
    notes: ''
  }),
  getters: {
    count: (s) => s.items.reduce((a, b) => a + Number(b.qty || 0), 0),
    hasItems: (s) => s.items.length > 0
  },
  actions: {
    _key(kind, id) { return `${kind}:${id}` },

    addFood(food, qty = 1) {
      const k = this._key('FOOD', food._id)
      const found = this.items.find(i => i.key === k)
      if (found) {
        found.qty += qty
      } else {
        this.items.push({
          key: k,
          kind: 'FOOD',
          id: food._id,
          name: food.name,
          qty,
          imageUrl: food.imageUrl || ''
        })
      }
    },

    // ✅ Store package contents so the UI can show each food + image
    addPackage(pkg, qty = 1) {
      const k = this._key('PACKAGE', pkg._id)
      const found = this.items.find(i => i.key === k)
      if (found) {
        found.qty += qty
      } else {
        this.items.push({
          key: k,
          kind: 'PACKAGE',
          id: pkg._id,
          name: pkg.name,
          qty,
          items: Array.isArray(pkg.items) ? pkg.items.map(it => ({ foodId: it.foodId, qty: it.qty })) : [],
          imageUrl: pkg.imageUrl || ''
        })
      }
    },

    inc(it){ it.qty++ },
    dec(it){ it.qty > 1 ? it.qty-- : (this.items = this.items.filter(x => x !== it)) },
    remove(it){ this.items = this.items.filter(x => x !== it) },

    clear(){
      this.items = []
      this.notes = ''
      this.groupKey = ''
      this.orderType = 'INDIVIDUAL'
    }
  }
})
