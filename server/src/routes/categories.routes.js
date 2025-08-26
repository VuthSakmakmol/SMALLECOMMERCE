const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/categories.controller')

// List + Get (public; lock down later if you prefer)
router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('q').optional().isString(),
    query('parentId').optional().isString()
  ],
  validate,
  ctrl.list
)

router.get('/:id', [param('id').isMongoId()], validate, ctrl.getOne)

// Create/Update/Toggle/Delete — ADMIN or CHEF
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [ body('name').isString().notEmpty(),
    body('parentId').optional().isMongoId(),
    body('order').optional().isInt({ min: 0 }) ],
  validate,
  ctrl.create
)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(),
    body('name').optional().isString().notEmpty(),
    body('parentId').optional().isMongoId(),
    body('order').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean() ],
  validate,
  ctrl.update
)

router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(),
    body('value').isBoolean() ],
  validate,
  ctrl.toggle
)

router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.removeOne
)

module.exports = router
