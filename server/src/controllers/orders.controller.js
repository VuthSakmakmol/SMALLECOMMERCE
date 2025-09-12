// server/src/controllers/orders.controller.js
const mongoose     = require('mongoose')
const Order        = require('../models/Order')
const Food         = require('../models/Food')
const Package      = require('../models/Package')
const Ingredient   = require('../models/Ingredient')
const ChoiceGroup  = require('../models/ChoiceGroup')

const STATUS = {
  PLACED:    'PLACED',
  ACCEPTED:  'ACCEPTED',
  COOKING:   'COOKING',
  READY:     'READY',
  DELIVERED: 'DELIVERED',
  CANCELED:  'CANCELED',
}
const ORDER_TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']

/* ───────────────── helpers ───────────────── */

function emitOrder (req, orderObj, event) {
  const io = req.app.get('io')
  if (!io) return
  io.to('room:admin').emit(event, orderObj)
  io.to('room:chef:default').emit(event, orderObj)
  if (orderObj.customerId) io.to(`room:customer:${orderObj.customerId}`).emit(event, orderObj)
  io.to(`room:order:${orderObj._id}`).emit(event, orderObj)
}

// Ensure `customerId` is a string and attach `customerName`
function serializeOrder(o) {
  const x = o?.toObject ? o.toObject() : o || {}
  const cust = x.customerId
  const customerId = cust && typeof cust === 'object'
    ? String(cust._id || cust.id || '')
    : String(cust || '')
  const customerName = cust && typeof cust === 'object'
    ? (cust.name || null)
    : (x.customerName || null)
  return { ...x, customerId, customerName }
}

/** Expand request/order items to a map of foodId -> total qty (packages expanded) */
async function expandToFoods(items, session = null) {
  const map = new Map()
  for (const it of (items || [])) {
    const qty = Math.max(1, parseInt(it.qty, 10) || 1)
    const kind = String(it.kind || '').toUpperCase()
    if (kind === 'FOOD' && it.foodId) {
      const k = String(it.foodId)
      map.set(k, (map.get(k) || 0) + qty)
    } else if (kind === 'PACKAGE' && it.packageId) {
      const pkg = await Package.findById(it.packageId).session(session).lean()
      if (!pkg) throw new Error('Package not found')
      for (const line of (pkg.items || [])) {
        const add = qty * Math.max(1, parseInt(line.qty, 10) || 1)
        const k = String(line.foodId)
        map.set(k, (map.get(k) || 0) + add)
      }
    } else {
      throw new Error('Invalid item kind')
    }
  }
  return map
}

/** Convert mods → readable snapshots (what we show back). */
function snapshotsFromMods(mods = []) {
  const ingredients = []
  const groups = []
  for (const m of mods) {
    if (m.kind === 'INGREDIENT') {
      ingredients.push({
        ingredientId: m.ingredientId,
        included: m.type === 'BOOLEAN' ? !!m.value : true,
        value: m.type === 'BOOLEAN' ? null : m.value,
        name: m.label || null,
      })
    } else if (m.kind === 'GROUP') {
      groups.push({
        groupId: m.groupId,
        choice: m.value,
        choiceLabel: m.choiceLabel || m.label || null,
      })
    }
  }
  return { ingredients, groups }
}

/** Atomically decrement stock for foods (null = unlimited → skip) */
async function decrementFoodsStock(session, foodMap) {
  for (const [foodId, need] of foodMap) {
    const doc = await Food.findById(foodId)
      .select('_id name stockQty isActiveGlobal isActiveKitchen')
      .session(session)
    if (!doc) throw new Error('Food not found')
    if (!doc.isActiveGlobal || !doc.isActiveKitchen) {
      throw new Error(`"${doc.name}" is not available`)
    }
    if (doc.stockQty === null) continue // unlimited
    const res = await Food.updateOne(
      { _id: foodId, stockQty: { $gte: need } },
      { $inc: { stockQty: -need } },
      { session }
    )
    if (res.matchedCount === 0) {
      throw new Error(`Not enough stock for "${doc.name}"`)
    }
  }
}

/** Increment back (only when stock is numeric) */
async function incrementFoodsStock(session, foodMap) {
  for (const [foodId, qty] of foodMap) {
    await Food.updateOne(
      { _id: foodId, stockQty: { $ne: null } },
      { $inc: { stockQty: qty } },
      { session }
    )
  }
}

/**
 * Sanitize and normalize user-submitted mods based on food attachments.
 * IMPORTANT:
 *  - INGREDIENTS: save ONLY what the user submitted (no defaults added).
 *  - GROUPS: save submitted; if a group is REQUIRED and missing, fill its default.
 */
async function sanitizeModsForFood(foodDoc, submittedMods = []) {
  const clean = []

  // attachments (what this food allows)
  const ingAttach = new Map()
  const grpAttach = new Map()
  for (const a of (foodDoc.ingredients || [])) {
    const id = String(a.ingredientId?._id || a.ingredientId)
    ingAttach.set(id, a)
  }
  for (const g of (foodDoc.choiceGroups || [])) {
    const id = String(g.groupId?._id || g.groupId)
    grpAttach.set(id, g)
  }

  // library definitions (types, ranges, choices)
  const ingIds = [...ingAttach.keys()]
  const grpIds = [...grpAttach.keys()]
  const [ingDefs, grpDefs] = await Promise.all([
    ingIds.length ? Ingredient.find({ _id: { $in: ingIds } }).lean() : [],
    grpIds.length ? ChoiceGroup.find({ _id: { $in: grpIds } }).lean() : []
  ])
  const ingDef = new Map(ingDefs.map(x => [String(x._id), x]))
  const grpDef = new Map(grpDefs.map(x => [String(x._id), x]))

  const seenGrp = new Set()

  for (const m of (submittedMods || [])) {
    const kind = String(m.kind || '').toUpperCase()
    if (kind === 'INGREDIENT') {
      const id = String(m.ingredientId || '')
      const attach = ingAttach.get(id)
      const def = ingDef.get(id)
      if (!attach || !def) continue

      const type = String(def.type || 'BOOLEAN').toUpperCase()
      if (type === 'BOOLEAN') {
        const v = !!m.value
        clean.push({ kind:'INGREDIENT', ingredientId:id, key:def.slug, type, value:v, label:def.name })
      } else if (type === 'PERCENT') {
        const n = Number(m.value)
        if (!Number.isFinite(n)) continue
        const v = Math.max(def.min ?? 0, Math.min(def.max ?? 100, n))
        clean.push({ kind:'INGREDIENT', ingredientId:id, key:def.slug, type, value:v, label:def.name })
      } else if (type === 'CHOICE') {
        const allowed = (def.choices || []).map(c => c.value)
        const val = allowed.includes(m.value) ? m.value : null
        if (val != null) clean.push({ kind:'INGREDIENT', ingredientId:id, key:def.slug, type, value:val, label:def.name })
      }
    }

    if (kind === 'GROUP') {
      const id = String(m.groupId || '')
      const attach = grpAttach.get(id)
      const def = grpDef.get(id)
      if (!attach || !def) continue
      const allowed = (def.choices || []).map(c => c.value)
      const val = allowed.includes(m.value) ? m.value : null
      if (val != null) {
        seenGrp.add(id)
        clean.push({ kind:'GROUP', groupId:id, key:def.key, type:'CHOICE', value:val, label:def.name })
      }
    }
  }

  // fill defaults for REQUIRED groups that user didn't submit
  for (const [gid, attach] of grpAttach) {
    if (seenGrp.has(gid)) continue
    const def = grpDef.get(gid)
    if (!def) continue
    const allowed = (def.choices || []).map(c => c.value)
    const val = attach.defaultChoice ?? allowed[0] ?? null
    if (def.required && val == null) throw new Error(`Missing required choice: ${def.name}`)
    if (val != null) clean.push({ kind:'GROUP', groupId:gid, key:def.key, type:'CHOICE', value:val, label:def.name })
  }

  return clean
}

/** ── NEW: derive submitted mods from legacy snapshots if client didn't send mods ── */
async function deriveModsFromLegacySnapshots(foodDoc, it) {
  const mods = []

  const ingAttach = new Map()
  const grpAttach = new Map()
  for (const a of (foodDoc.ingredients || [])) {
    const id = String(a.ingredientId?._id || a.ingredientId)
    ingAttach.set(id, a)
  }
  for (const g of (foodDoc.choiceGroups || [])) {
    const id = String(g.groupId?._id || g.groupId)
    grpAttach.set(id, g)
  }

  const ingIds = [...ingAttach.keys()]
  const grpIds = [...grpAttach.keys()]
  const [ingDefs, grpDefs] = await Promise.all([
    ingIds.length ? Ingredient.find({ _id: { $in: ingIds } }).lean() : [],
    grpIds.length ? ChoiceGroup.find({ _id: { $in: grpIds } }).lean() : []
  ])
  const ingDef = new Map(ingDefs.map(x => [String(x._id), x]))
  const grpDef = new Map(grpDefs.map(x => [String(x._id), x]))

  // INGREDIENTS from legacy snapshots
  for (const sel of (it.ingredients || [])) {
    const id  = String(sel.ingredientId || '')
    const def = ingDef.get(id)
    if (!def) continue
    const type = String(def.type || 'BOOLEAN').toUpperCase()

    if (type === 'BOOLEAN') {
      // record explicit include true/false when provided
      if (typeof sel.included === 'boolean') {
        mods.push({
          kind: 'INGREDIENT',
          ingredientId: id,
          key: def.slug,
          type,
          value: !!sel.included,
          label: def.name
        })
      }
    } else if (type === 'PERCENT') {
      // only when included AND numeric value present
      if (sel.included && sel.value != null) {
        const n = Number(sel.value)
        if (Number.isFinite(n)) {
          const clamped = Math.max(def.min ?? 0, Math.min(def.max ?? 100, n))
          mods.push({
            kind: 'INGREDIENT',
            ingredientId: id,
            key: def.slug,
            type,
            value: clamped,
            label: def.name
          })
        }
      }
    } else if (type === 'CHOICE') {
      if (sel.included && sel.value != null) {
        const allowed = (def.choices || []).map(c => c.value)
        if (allowed.includes(sel.value)) {
          mods.push({
            kind: 'INGREDIENT',
            ingredientId: id,
            key: def.slug,
            type,
            value: sel.value,
            label: def.name
          })
        }
      }
    }
  }

  // GROUPS from legacy snapshots
  for (const g of (it.groups || [])) {
    const id  = String(g.groupId || '')
    const def = grpDef.get(id)
    if (!def) continue
    const allowed = (def.choices || []).map(c => c.value)
    if (g.choice != null && allowed.includes(g.choice)) {
      mods.push({
        kind: 'GROUP',
        groupId: id,
        key: def.key,
        type: 'CHOICE',
        value: g.choice,
        label: def.name
      })
    }
  }

  return mods
}

/* ───────────────── controllers ───────────────── */

// GET /orders?status=&type=&groupKey=&q=&scope=
async function list (req, res, next) {
  try {
    const { status, type, groupKey, q, scope } = req.query
    const filter = {}

    if (String(scope).toUpperCase() === 'CUSTOMER' && req.user?._id) {
      filter.customerId = req.user._id
    }

    if (status === 'ACTIVE') filter.status = { $nin: [STATUS.DELIVERED, STATUS.CANCELED] }
    else if (status) filter.status = status
    if (type) filter.type = type
    if (groupKey) filter.groupKey = groupKey
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim(), 'i')
      filter.$or = [{ groupKey: rx }, { notes: rx }, { 'items.name': rx }]
    }

    const rows = await Order.find(filter)
      .sort({ createdAt: -1 })
      .populate({ path: 'customerId', select: 'name' })
      .lean()

    // backfill missing item images (legacy)
    const needFoodIds = new Set(), needPkgIds = new Set()
    for (const o of rows) {
      for (const it of (o.items || [])) {
        if (!it.imageUrl) {
          if (it.kind === 'FOOD' && it.foodId) needFoodIds.add(String(it.foodId))
          if (it.kind === 'PACKAGE' && it.packageId) needPkgIds.add(String(it.packageId))
        }
      }
    }
    let foodMap = new Map(), pkgMap  = new Map()
    if (needFoodIds.size) {
      const foods = await Food.find({ _id: { $in: [...needFoodIds] } }).select('_id imageUrl').lean()
      foodMap = new Map(foods.map(f => [String(f._id), f.imageUrl || '']))
    }
    if (needPkgIds.size) {
      const pkgs = await Package.find({ _id: { $in: [...needPkgIds] } }).select('_id imageUrl').lean()
      pkgMap = new Map(pkgs.map(p => [String(p._id), p.imageUrl || '']))
    }
    for (const o of rows) {
      for (const it of (o.items || [])) {
        if (!it.imageUrl) {
          if (it.kind === 'FOOD' && it.foodId) it.imageUrl = foodMap.get(String(it.foodId)) || ''
          if (it.kind === 'PACKAGE' && it.packageId) it.imageUrl = pkgMap.get(String(it.packageId)) || ''
        }
      }
    }

    // send what we saved: mods + derived snapshots
    res.json(rows.map(o => serializeOrder(o)))
  } catch (e) { next(e) }
}

// GET /orders/:id
async function getOne (req, res, next) {
  try {
    const row = await Order.findById(req.params.id)
      .populate({ path: 'customerId', select: 'name' })
    if (!row) return res.status(404).json({ message: 'Order not found' })
    res.json(serializeOrder(row))
  } catch (e) { next(e) }
}

// server/src/controllers/orders.controller.js  (inside module.exports file)
async function create (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const authedId = req.user?._id || req.user?.id
    if (!authedId) {
      await session.abortTransaction(); session.endSession()
      return res.status(401).json({ message: 'Unauthenticated' })
    }

    // validate type
    const type = (req.body.type || 'INDIVIDUAL').toUpperCase()
    if (!ORDER_TYPES.includes(type)) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ message: 'Invalid order type' })
    }

    // read pre-order fields
    const rawWhen = req.body.scheduledFor || null  // ISO string or null
    const receivePlace = String(req.body.receivePlace || '').trim()
    let scheduledFor = null
    if (rawWhen) {
      const dt = new Date(rawWhen)
      if (Number.isNaN(dt.getTime())) {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ message: 'Invalid scheduledFor date/time' })
      }
      scheduledFor = dt
    }

    // validate items
    const itemsReq = Array.isArray(req.body.items) ? req.body.items : []
    if (!itemsReq.length) {
      await session.abortTransaction(); session.endSession()
      return res.status(400).json({ message: 'At least one item is required' })
    }

    const prepared = []
    for (const it of itemsReq) {
      const kind = String(it.kind || '').toUpperCase()
      const qty  = Math.max(1, parseInt(it.qty, 10) || 1)

      if (kind === 'FOOD') {
        const f = await Food.findById(it.foodId)
          .populate('ingredients.ingredientId', 'name slug type choices min max step defaultValue')
          .populate('choiceGroups.groupId', 'name key choices required')
          .session(session)
        if (!f) {
          await session.abortTransaction(); session.endSession()
          return res.status(400).json({ message: 'Food not found', id: it.foodId })
        }

        // Prefer submitted mods; otherwise derive from legacy snapshots (ingredients/groups)
        const submittedMods = Array.isArray(it.mods) ? it.mods : null
        let safeMods
        if (submittedMods && submittedMods.length) {
          safeMods = await sanitizeModsForFood(f, submittedMods)
        } else {
          // derive from legacy selections the client might have sent
          const legacyMods = await (async function deriveModsFromLegacySnapshots(foodDoc, itemLike) {
            const mods = []

            // attachments
            const ingAttach = new Map()
            const grpAttach = new Map()
            for (const a of (foodDoc.ingredients || [])) {
              const id = String(a.ingredientId?._id || a.ingredientId)
              ingAttach.set(id, a)
            }
            for (const g of (foodDoc.choiceGroups || [])) {
              const id = String(g.groupId?._id || g.groupId)
              grpAttach.set(id, g)
            }

            // library defs
            const ingIds = [...ingAttach.keys()]
            const grpIds = [...grpAttach.keys()]
            const [ingDefs, grpDefs] = await Promise.all([
              ingIds.length ? Ingredient.find({ _id: { $in: ingIds } }).lean() : [],
              grpIds.length ? ChoiceGroup.find({ _id: { $in: grpIds } }).lean() : []
            ])
            const ingDef = new Map(ingDefs.map(x => [String(x._id), x]))
            const grpDef = new Map(grpDefs.map(x => [String(x._id), x]))

            // ingredients → mods
            for (const sel of (itemLike.ingredients || [])) {
              const id  = String(sel.ingredientId || '')
              const def = ingDef.get(id)
              if (!def) continue
              const typ = String(def.type || 'BOOLEAN').toUpperCase()
              if (typ === 'BOOLEAN') {
                if (typeof sel.included === 'boolean') {
                  mods.push({ kind:'INGREDIENT', ingredientId:id, key:def.slug, type:typ, value:!!sel.included, label:def.name })
                }
              } else if (typ === 'PERCENT') {
                if (sel.included && sel.value != null) {
                  const n = Number(sel.value)
                  if (Number.isFinite(n)) {
                    const v = Math.max(def.min ?? 0, Math.min(def.max ?? 100, n))
                    mods.push({ kind:'INGREDIENT', ingredientId:id, key:def.slug, type:typ, value:v, label:def.name })
                  }
                }
              } else if (typ === 'CHOICE') {
                if (sel.included && sel.value != null) {
                  const allowed = (def.choices || []).map(c => c.value)
                  if (allowed.includes(sel.value)) {
                    mods.push({ kind:'INGREDIENT', ingredientId:id, key:def.slug, type:typ, value:sel.value, label:def.name })
                  }
                }
              }
            }

            // groups → mods
            for (const g of (itemLike.groups || [])) {
              const id  = String(g.groupId || '')
              const def = grpDef.get(id)
              if (!def) continue
              const allowed = (def.choices || []).map(c => c.value)
              if (g.choice != null && allowed.includes(g.choice)) {
                mods.push({ kind:'GROUP', groupId:id, key:def.key, type:'CHOICE', value:g.choice, label:def.name })
              }
            }
            return mods
          })(f, it)

          safeMods = await sanitizeModsForFood(f, legacyMods)
        }

        // human-friendly snapshots from mods (what customer actually picked)
        const snaps = snapshotsFromMods(safeMods)

        prepared.push({
          kind: 'FOOD',
          foodId: f._id,
          name: f.name,
          imageUrl: f.imageUrl || '',
          qty,
          unitPrice: 0,
          mods: safeMods,
          ingredients: snaps.ingredients,
          groups: snaps.groups,
        })
      } else if (kind === 'PACKAGE') {
        const p = await Package.findById(it.packageId).select('_id name imageUrl').session(session)
        if (!p) {
          await session.abortTransaction(); session.endSession()
          return res.status(400).json({ message: 'Package not found', id: it.packageId })
        }
        prepared.push({
          kind: 'PACKAGE',
          packageId: p._id,
          name: p.name,
          imageUrl: p.imageUrl || '',
          qty,
          unitPrice: 0
        })
      } else {
        await session.abortTransaction(); session.endSession()
        return res.status(400).json({ message: 'Invalid item kind', kind: it.kind })
      }
    }

    // Decrement food stock now (expanding packages to foods)
    const foodMap = await expandToFoods(itemsReq, session)
    await decrementFoodsStock(session, foodMap)

    // Create order
    const [doc] = await Order.create([{
      type,
      status: STATUS.PLACED,
      customerId: authedId,
      groupKey: type === 'GROUP' && String(req.body.groupKey || '').trim()
        ? String(req.body.groupKey).trim() : null,
      notes: req.body.notes || '',

      // NEW pre-order fields
      scheduledFor,          // Date or null
      receivePlace,          // string ('' allowed)

      items: prepared,
      grandTotal: 0,
      stockCommitted: true,
      createdBy: authedId,
      updatedBy: authedId,
    }], { session })

    await session.commitTransaction()
    await doc.populate({ path: 'customerId', select: 'name' })

    const order = serializeOrder(doc)
    emitOrder(req, order, 'order:new')
    res.status(201).json(order)
  } catch (e) {
    await session.abortTransaction()
    next(e)
  } finally {
    session.endSession()
  }
}


// PATCH /orders/:id/accept
async function accept (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== STATUS.PLACED) {
      return res.status(400).json({ message: `Order must be ${STATUS.PLACED} before accepting` })
    }
    order.status = STATUS.ACCEPTED
    order.acceptedAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/start
async function start (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (![STATUS.ACCEPTED, STATUS.PLACED].includes(order.status)) {
      return res.status(400).json({ message: 'Order must be ACCEPTED (or PLACED) to start cooking' })
    }
    order.status = STATUS.COOKING
    order.cookingAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/ready
async function ready (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (![STATUS.COOKING, STATUS.ACCEPTED].includes(order.status)) {
      return res.status(400).json({ message: 'Order must be COOKING/ACCEPTED to mark READY' })
    }
    order.status = STATUS.READY
    order.readyAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/deliver
async function deliver (req, res, next) {
  try {
    const order = await Order.findById(req.params.id)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if (order.status !== STATUS.READY) {
      return res.status(400).json({ message: 'Order must be READY to deliver' })
    }

    const role = req.user?.role
    const uid  = String(req.user?._id || '')
    if (role === 'CUSTOMER' && String(order.customerId) !== uid) {
      return res.status(403).json({ message: 'Customers can only deliver their own orders' })
    }

    order.status = STATUS.DELIVERED
    order.deliveredAt = new Date()
    order.updatedBy = req.user?._id || null
    await order.save()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) { next(e) }
}

// PATCH /orders/:id/cancel  (restore foods if numeric)
async function cancel (req, res, next) {
  const session = await mongoose.startSession()
  session.startTransaction()
  try {
    const order = await Order.findById(req.params.id).session(session)
    if (!order) return res.status(404).json({ message: 'Order not found' })
    if ([STATUS.DELIVERED, STATUS.CANCELED].includes(order.status)) {
      return res.status(400).json({ message: 'Order already finished' })
    }

    // Expand to foods and restore only numeric stocks
    const foodMap = await expandToFoods(order.items, session)
    await incrementFoodsStock(session, foodMap)

    order.status = STATUS.CANCELED
    order.canceledAt = new Date()
    order.updatedBy = req.user?._id || null
    order.stockCommitted = false
    await order.save({ session })

    await session.commitTransaction()

    await order.populate({ path: 'customerId', select: 'name' })
    const payload = serializeOrder(order)
    emitOrder(req, payload, 'order:status')
    res.json(payload)
  } catch (e) {
    await session.abortTransaction()
    next(e)
  } finally {
    session.endSession()
  }
}

module.exports = {
  list,
  getOne,
  create,
  accept,
  start,
  ready,
  deliver,
  cancel,
}
