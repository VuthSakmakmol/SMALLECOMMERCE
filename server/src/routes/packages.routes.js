// server/src/routes/package.routes.js
const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/package.controller')

// Public list + get
router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('q').optional().isString().trim()
  ],
  validate,
  ctrl.list
)

router.get('/:id',
  [ param('id').isMongoId() ],
  validate,
  ctrl.getOne
)

// Create (ADMIN + CHEF)
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isIn(['Individual','Group','Workshop']),
    body('description').optional().isString(),
    body('imageUrl').optional().isString(),
    body('items').isArray({ min: 1 }),
    body('items.*.foodId').isMongoId(),
    body('items.*.qty').isInt({ min: 1 }),
  ],
  validate,
  ctrl.create
)

// Update (ADMIN + CHEF)
router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isIn(['Individual','Group','Workshop']),
    body('description').optional().isString(),
    body('imageUrl').optional().isString(),
    body('isActive').optional().isBoolean(),
    body('dailyLimit').optional().custom(v => v === null || (Number.isInteger(v) && v >= 0)),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.foodId').optional().isMongoId(),
    body('items.*.qty').optional().isInt({ min: 1 }),
  ],
  validate,
  ctrl.update
)

// Toggle active (ADMIN + CHEF)
router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('value').isBoolean()
  ],
  validate,
  ctrl.toggle
)

// Daily stock (ADMIN | CHEF)
router.patch('/:id/stock',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('dailyLimit').custom(v => v === null || (Number.isInteger(v) && v >= 0))
  ],
  validate,
  ctrl.setStock
)

// Delete (ADMIN + CHEF)
router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.removeOne
)

module.exports = router
