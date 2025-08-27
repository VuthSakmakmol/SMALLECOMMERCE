const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/orders.controller')

/**
 * GET /orders
 * Query filters are optional.
 * ?status=PLACED|ACCEPTED|COOKING|READY|DELIVERED|CANCELED
 * ?type=INDIVIDUAL|GROUP|WORKSHOP
 * ?groupKey=TABLE-1 (or any string you use to group)
 */
router.get('/',
  authenticate,
  [
    query('status').optional().isIn(['PLACED','ACCEPTED','COOKING','READY','DELIVERED','CANCELED']),
    query('type').optional().isIn(['INDIVIDUAL','GROUP','WORKSHOP']),
    query('groupKey').optional().isString().trim()
  ],
  validate,
  ctrl.list
)

/**
 * POST /orders
 * body: {
 *   type: 'INDIVIDUAL'|'GROUP'|'WORKSHOP',
 *   groupKey?, customerId?, customerName?, phone?, notes?,
 *   items: [{ kind:'FOOD'|'PACKAGE', foodId?, packageId?, qty, unitPrice? }]
 * }
 */
router.post('/',
  authenticate, authorize('ADMIN','CUSTOMER'),
  [
    body('type').optional().isIn(['INDIVIDUAL','GROUP','WORKSHOP']),
    body('groupKey').optional().isString().trim(),
    body('customerId').optional().isString().trim(),
    body('customerName').optional().isString().trim(),
    body('phone').optional().isString().trim(),
    body('notes').optional().isString(),
    body('items').isArray({ min: 1 }),
    body('items.*.kind').isIn(['FOOD','PACKAGE']),
    body('items.*.qty').isInt({ min: 1 }),
    body('items.*.foodId').optional().isMongoId(),
    body('items.*.packageId').optional().isMongoId(),
    body('items.*.unitPrice').optional().isFloat({ min: 0 })
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

/**
 * PATCH /orders/:id/deliver
 * Allow any authenticated user; controller can enforce that customers
 * may deliver only their own order if you choose to add that rule.
 */
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
