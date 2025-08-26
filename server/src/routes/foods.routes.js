const router = require('express').Router()
const { body } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/foods.controller')

// public list
router.get('/', ctrl.list)

// admin CRUD (no price anymore)
router.post('/',
  authenticate, authorize('ADMIN'),
  [ body('name').isString().notEmpty(), body('categoryId').isMongoId() ],
  validate, ctrl.create)

router.put('/:id',
  authenticate, authorize('ADMIN'),
  [ body('name').optional().isString().notEmpty(), body('categoryId').optional().isMongoId() ],
  validate, ctrl.update)

router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.removeOne)

// toggle availability (ADMIN or CHEF)
router.patch('/:id/toggle',
  authenticate, authorize('ADMIN', 'CHEF'),
  [ body('scope').isIn(['GLOBAL', 'KITCHEN']), body('value').isBoolean() ],
  validate, ctrl.toggle)

module.exports = router
