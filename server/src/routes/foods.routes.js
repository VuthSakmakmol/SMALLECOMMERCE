const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/foods.controller')

// Public
router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('inStockOnly').optional().isIn(['true','false']),
    query('categoryId').optional().isMongoId(),
    query('q').optional().isString().trim()
  ],
  validate, ctrl.list
)
router.get('/:id', [ param('id').isMongoId() ], validate, ctrl.getOne)

// Admin/Chef
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isString().trim().notEmpty(),
    body('categoryId').isMongoId(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('stockQty').optional().custom(v => v === null || (Number.isInteger(v) && v >= 0))
  ],
  validate, ctrl.create
)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().trim().notEmpty(),
    body('categoryId').optional().isMongoId(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('tags').optional().isArray(),
    body('tags.*').optional().isString(),
    body('isActiveGlobal').optional().isBoolean(),
    body('isActiveKitchen').optional().isBoolean(),
    body('stockQty').optional().custom(v => v === null || (Number.isInteger(v) && v >= 0))
  ],
  validate, ctrl.update
)

router.patch('/:id/stock',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(), body('stockQty').custom(v => v === null || (Number.isInteger(v) && v >= 0)) ],
  validate, ctrl.setStock
)

router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate, ctrl.removeOne
)

module.exports = router
