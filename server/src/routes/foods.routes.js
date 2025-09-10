const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/foods.controller')

router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('q').optional().isString().trim(),
    query('categoryId').optional().isMongoId()
  ],
  validate, ctrl.list)

router.get('/:id', [ param('id').isMongoId() ], validate, ctrl.getOne)

router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isString().notEmpty(),
    body('categoryId').isMongoId(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('tags').optional().isArray(),
    body('stockQty').optional({ values: 'null' }).custom(v => v === null || Number.isFinite(Number(v))),
    body('ingredients').optional().isArray(),
    body('choiceGroups').optional().isArray()
  ],
  validate, ctrl.create)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().notEmpty(),
    body('categoryId').optional().isMongoId(),
    body('imageUrl').optional().isString(),
    body('description').optional().isString(),
    body('tags').optional().isArray(),
    body('stockQty').optional({ values: 'null' }).custom(v => v === null || Number.isFinite(Number(v))),
    body('ingredients').optional().isArray(),
    body('choiceGroups').optional().isArray()
  ],
  validate, ctrl.update)

router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('scope').isIn(['GLOBAL','KITCHEN']),
    body('value').isBoolean()
  ],
  validate, ctrl.toggle)

router.patch('/:id/stock',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(), body('stockQty').optional({ values: 'null' }) ],
  validate, ctrl.setStock)

router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate, ctrl.remove)

module.exports = router
