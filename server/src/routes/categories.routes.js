const router = require('express').Router()
const { body } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/categories.controller')

// list (public or protect later)
router.get('/', ctrl.list)

// admin-only CRUD
router.post('/', authenticate, authorize('ADMIN'),
  [ body('name').isString().notEmpty() ],
  validate, ctrl.create)

router.put('/:id', authenticate, authorize('ADMIN'),
  [ body('name').optional().isString().notEmpty(), body('order').optional().isInt({ min: 0 }) ],
  validate, ctrl.update)

router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.removeOne)

router.patch('/:id/toggle', authenticate, authorize('ADMIN'),
  [ body('value').isBoolean() ],
  validate, ctrl.toggle)

module.exports = router
