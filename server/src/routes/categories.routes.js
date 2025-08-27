const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/categories.controller')

// Public list + get
router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('q').optional().isString().trim(),
    query('parentId').optional().isString()
  ],
  validate,
  ctrl.list
)

router.get('/:id',
  [ param('id').isMongoId() ],
  validate,
  ctrl.getOne
)

// Create (ADMIN | CHEF)
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isString().trim().notEmpty(),
    body('parentId').optional().isMongoId(),
    body('order').optional().isInt({ min: 0 })
  ],
  validate,
  ctrl.create
)

// Update (ADMIN | CHEF)
router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().trim().notEmpty(),
    body('parentId').optional().isMongoId(),
    body('order').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean()
  ],
  validate,
  ctrl.update
)

// Toggle active (ADMIN | CHEF)
router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('value').isBoolean()
  ],
  validate,
  ctrl.toggle
)

// Delete (ADMIN | CHEF)
router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.removeOne
)

module.exports = router
