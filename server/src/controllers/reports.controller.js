// server/src/controllers/reports.controller.js
const dayjs = require('dayjs')
const Order = require('../models/Order')
const Food = require('../models/Food')
const Package = require('../models/Package')
const User = require('../models/User')

const STATUS = {
  PLACED:    'PLACED',
  ACCEPTED:  'ACCEPTED',
  COOKING:   'COOKING',
  READY:     'READY',
  DELIVERED: 'DELIVERED',
  CANCELED:  'CANCELED'
}
const ACTIVE_STATUSES = [STATUS.PLACED, STATUS.ACCEPTED, STATUS.COOKING, STATUS.READY]
const TYPES = ['INDIVIDUAL', 'GROUP', 'WORKSHOP']

/** GET /reports/admin/summary?days=14 */
async function adminSummary (req, res, next) {
  try {
    const days = Math.min(180, Math.max(1, parseInt(req.query.days, 10) || 14))
    const now = dayjs()
    const from = now.startOf('day').subtract(days - 1, 'day').toDate()
    const todayStart = now.startOf('day').toDate()
    const todayEnd = now.endOf('day').toDate()

    // Basic counts
    const [
      totalUsers,
      activeUsers,
      adminUsers,
      chefUsers,
      customerUsers,

      totalFoods,
      activeFoods,
      totalPkgs,
      activePkgs,

      totalOrders,
      deliveredOrders,
      canceledOrders,
      activeOrders,

      // status + type distributions (all time)
      statusAgg,
      typeAgg,

      // time series for last N days
      seriesAgg,

      // Top items (last N days)
      topFoodsAgg,
      topPkgsAgg,

      // Today
      todayTotal,
      todayDelivered,
      todayCanceled,

      // Recent
      recentOrders
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: 'ADMIN' }),
      User.countDocuments({ role: 'CHEF' }),
      User.countDocuments({ role: 'CUSTOMER' }),

      Food.countDocuments({}),
      // "Active" food: globally on AND kitchen on; stock remaining if limited
      Food.countDocuments({
        isActiveGlobal: true,
        isActiveKitchen: true,
        $or: [{ dailyLimit: null }, { stockRemaining: { $gt: 0 } }]
      }),

      Package.countDocuments({}),
      Package.countDocuments({ isActive: true }),

      Order.countDocuments({}),
      Order.countDocuments({ status: STATUS.DELIVERED }),
      Order.countDocuments({ status: STATUS.CANCELED }),
      Order.countDocuments({ status: { $in: ACTIVE_STATUSES } }),

      // distributions
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Order.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),

      // series (last N days)
      Order.aggregate([
        { $match: { createdAt: { $gte: from } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // top foods last N days
      Order.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $unwind: '$items' },
        { $match: { 'items.kind': 'FOOD' } },
        {
          $group: {
            _id: '$items.foodId',
            name: { $first: '$items.name' },
            qty: { $sum: '$items.qty' }
          }
        },
        { $sort: { qty: -1 } },
        { $limit: 5 }
      ]),
      // top packages last N days
      Order.aggregate([
        { $match: { createdAt: { $gte: from } } },
        { $unwind: '$items' },
        { $match: { 'items.kind': 'PACKAGE' } },
        {
          $group: {
            _id: '$items.packageId',
            name: { $first: '$items.name' },
            qty: { $sum: '$items.qty' }
          }
        },
        { $sort: { qty: -1 } },
        { $limit: 5 }
      ]),

      Order.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Order.countDocuments({ status: STATUS.DELIVERED, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      Order.countDocuments({ status: STATUS.CANCELED, createdAt: { $gte: todayStart, $lte: todayEnd } }),

      Order.find({})
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ])

    // normalize series to include empty days
    const seriesMap = new Map(seriesAgg.map(d => [d._id, d.count]))
    const series = []
    for (let i = days - 1; i >= 0; i--) {
      const d = now.startOf('day').subtract(i, 'day').format('YYYY-MM-DD')
      series.push({ date: d, count: seriesMap.get(d) || 0 })
    }

    res.json({
      meta: { from, to: now.toDate(), days },
      cards: {
        orders: {
          total: totalOrders,
          active: activeOrders,
          delivered: deliveredOrders,
          canceled: canceledOrders
        },
        today: {
          total: todayTotal,
          delivered: todayDelivered,
          canceled: todayCanceled
        },
        users: {
          total: totalUsers,
          active: activeUsers,
          admins: adminUsers,
          chefs: chefUsers,
          customers: customerUsers
        },
        menu: {
          foods: { total: totalFoods, active: activeFoods },
          packages: { total: totalPkgs, active: activePkgs }
        }
      },
      distributions: {
        byStatus: statusAgg.map(s => ({ status: s._id, count: s.count })),
        byType: typeAgg
          .filter(t => TYPES.includes(t._id))
          .map(t => ({ type: t._id, count: t.count }))
      },
      series, // [{date:'YYYY-MM-DD', count}]
      topFoods: topFoodsAgg.map(x => ({ id: x._id, name: x.name, qty: x.qty })),
      topPackages: topPkgsAgg.map(x => ({ id: x._id, name: x.name, qty: x.qty })),
      recentOrders
    })
  } catch (e) { next(e) }
}

module.exports = { adminSummary }
