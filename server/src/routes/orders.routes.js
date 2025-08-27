// server/src/routes/orders.routes.js
const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/orders.controller')

/**
 * GET /orders
 * ?status=ACTIVE|PLACED|ACCEPTED|COOKING|READY|DELIVERED|CANCELED
 * ?type=INDIVIDUAL|GROUP|WORKSHOP
 * ?groupKey=XYZ
 * ?q=search-text (matches groupKey / notes / item names)
 */
router.get('/',
  authenticate,
  [
    query('status').optional().isIn(['ACTIVE','PLACED','ACCEPTED','COOKING','READY','DELIVERED','CANCELED']),
    query('type').optional().isIn(['INDIVIDUAL','GROUP','WORKSHOP']),
    query('groupKey').optional().isString().trim(),
    query('q').optional().isString().trim(),
  ],
  validate,
  ctrl.list
)

/**
 * POST /orders
 * body: {
 *   type?: 'INDIVIDUAL'|'GROUP'|'WORKSHOP',
 *   groupKey?: string,
 *   notes?: string,
 *   items: [{ kind:'FOOD'|'PACKAGE', foodId?, packageId?, qty }]
 * }
 */
router.post('/',
  authenticate, authorize('ADMIN','CUSTOMER'),
  [
    body('type').optional().isIn(['INDIVIDUAL','GROUP','WORKSHOP']),
    body('groupKey').optional().isString().trim(),
    body('notes').optional().isString(),
    body('items').isArray({ min: 1 }),
    body('items.*.kind').isIn(['FOOD','PACKAGE']),
    body('items.*.qty').isInt({ min: 1 }),
    body('items.*.foodId').optional().isMongoId(),
    body('items.*.packageId').optional().isMongoId(),
  ],
  validate,
  ctrl.create
)

/** GET /orders/:id */
router.get('/:id',
  authenticate,
  [ param('id').isMongoId() ],
  validate,
  ctrl.getOne
)

/** PATCH /orders/:id/accept (CHEF | ADMIN) */
router.patch('/:id/accept',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.accept
)

/** PATCH /orders/:id/start (CHEF | ADMIN) */
router.patch('/:id/start',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.start
)

/** PATCH /orders/:id/ready (CHEF | ADMIN) */
router.patch('/:id/ready',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.ready
)

/** PATCH /orders/:id/deliver (any authed; controller restricts customer to own order) */
router.patch('/:id/deliver',
  authenticate,
  [ param('id').isMongoId() ],
  validate,
  ctrl.deliver
)

/** PATCH /orders/:id/cancel (CHEF | ADMIN) */
router.patch('/:id/cancel',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.cancel
)

module.exports = router
