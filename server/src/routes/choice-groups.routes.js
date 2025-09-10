const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/choiceGroups.controller')

router.get('/',
  [ query('activeOnly').optional().isIn(['true','false']), query('q').optional().isString().trim() ],
  validate, ctrl.list)

router.get('/:id', [ param('id').isMongoId() ], validate, ctrl.getOne)

router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isString().notEmpty(),
    body('key').isString().notEmpty(),
    body('required').optional().isBoolean(),
    body('choices').isArray({ min: 1 }),
    body('choices.*.value').isString(),
    body('choices.*.label').isString()
  ],
  validate, ctrl.create)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().notEmpty(),
    body('key').optional().isString().notEmpty(),
    body('required').optional().isBoolean(),
    body('choices').optional().isArray({ min: 1 }),
    body('isActive').optional().isBoolean()
  ],
  validate, ctrl.update)

router.patch('/:id/toggle',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId(), body('value').isBoolean() ],
  validate, ctrl.toggle)

router.delete('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [ param('id').isMongoId() ],
  validate, ctrl.removeOne)

module.exports = router
