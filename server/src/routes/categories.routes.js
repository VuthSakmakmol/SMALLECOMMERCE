const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/categories.controller')

// List + Get
router.get('/',
  [
    query('activeOnly').optional().isIn(['true','false']),
    query('q').optional().isString()
  ],
  validate,
  ctrl.list
)

router.get('/:id', [param('id').isMongoId()], validate, ctrl.getOne)

// Create/Update/Toggle/Delete — ADMIN or CHEF
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [ body('name').isString().notEmpty() ],
  validate,
  ctrl.create
)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(),
    body('name').optional().isString().notEmpty(),
    body('isActive').optional().isBoolean() ],
  validate,
  ctrl.update
)

router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(), body('value').isBoolean() ],
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
