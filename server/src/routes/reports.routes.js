// server/src/routes/reports.routes.js
const router = require('express').Router()
const { query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/reports.controller')

// GET /reports/admin/summary?days=14
router.get(
  '/admin/summary',
  authenticate,
  authorize('ADMIN'),
  [query('days').optional().isInt({ min: 1, max: 180 })],
  validate,
  ctrl.adminSummary
)

module.exports = router
