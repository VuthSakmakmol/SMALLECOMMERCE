const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/foods.controller')

// Public list + get (so Customer app can read)
router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('categoryId').optional().isMongoId(),
    query('q').optional().isString()
  ],
  validate,
  ctrl.list
)
router.get('/:id', [param('id').isMongoId()], validate, ctrl.getOne)

// ✅ CHEF + ADMIN can CRUD
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isString().notEmpty(),
    body('categoryId').isMongoId(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('tags').optional().isArray()
  ],
  validate,
  ctrl.create
)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().notEmpty(),
    body('categoryId').optional().isMongoId(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('tags').optional().isArray(),
    body('isActiveGlobal').optional().isBoolean(),
    body('isActiveKitchen').optional().isBoolean()
  ],
  validate,
  ctrl.update
)

router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate,
  ctrl.removeOne
)

// availability toggles
router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(), body('scope').isIn(['GLOBAL','KITCHEN']), body('value').isBoolean() ],
  validate,
  ctrl.toggle
)

// daily portions (stock)
router.patch('/:id/stock',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('dailyLimit').custom(v => v === null || (Number.isInteger(v) && v >= 0))
  ],
  validate,
  ctrl.setStock
)

module.exports = router
