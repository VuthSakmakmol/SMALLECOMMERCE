// server/src/routes/orders.routes.js
const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/orders.controller')

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

router.get('/:id',
  authenticate,
  [ param('id').isMongoId() ],
  validate,
  ctrl.getOne
)

router.patch('/:id/accept',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.accept
)

router.patch('/:id/start',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.start
)

router.patch('/:id/ready',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.ready
)

router.patch('/:id/deliver',
  authenticate,
  [ param('id').isMongoId() ],
  validate,
  ctrl.deliver
)

router.patch('/:id/cancel',
  authenticate, authorize('CHEF','ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.cancel
)

module.exports = router
