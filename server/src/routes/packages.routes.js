const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/package.controller') // make sure this path matches

// Public list + get (so Workshop/Packages can be shown to customers)
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

// Create package (ADMIN only)
router.post('/',
  authenticate, authorize('ADMIN'),
  [
    body('name').isString().trim().notEmpty(),
    body('price').isFloat({ min: 0 }),
    body('description').optional().isString(),
    body('imageUrl').optional().isString(),
    body('items').isArray({ min: 1 }),
    body('items.*.foodId').isMongoId(),
    body('items.*.qty').isInt({ min: 1 }),
  ],
  validate,
  ctrl.create
)

// Update package (ADMIN)
router.put('/:id',
  authenticate, authorize('ADMIN'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().trim().notEmpty(),
    body('price').optional().isFloat({ min: 0 }),
    body('description').optional().isString(),
    body('imageUrl').optional().isString(),
    body('isActive').optional().isBoolean(),
    body('items').optional().isArray({ min: 1 }),
    body('items.*.foodId').optional().isMongoId(),
    body('items.*.qty').optional().isInt({ min: 1 }),
  ],
  validate,
  ctrl.update
)

// Toggle active (ADMIN)
router.patch('/:id/toggle',
  authenticate, authorize('ADMIN'),
  [
    param('id').isMongoId(),
    body('value').isBoolean()
  ],
  validate,
  ctrl.toggle
)

// Delete package (ADMIN)
router.delete('/:id',
  authenticate, authorize('ADMIN'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.removeOne
)

module.exports = router
