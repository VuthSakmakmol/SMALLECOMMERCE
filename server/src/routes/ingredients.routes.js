const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/ingredients.controller')

router.get('/',
  [ query('activeOnly').optional().isIn(['true','false']), query('q').optional().isString().trim() ],
  validate, ctrl.list)

router.get('/:id', [ param('id').isMongoId() ], validate, ctrl.getOne)

// routes/ingredients.js
router.post('/',
  authenticate, authorize('ADMIN','CHEF'),
  [
    body('name').isString().notEmpty().trim(),
    body('slug').optional().isString().notEmpty().trim(),   // <-- was required
    body('type').isIn(['BOOLEAN','PERCENT','CHOICE']),
    body('choices').optional().isArray(),
    body('min').optional().isNumeric(),
    body('max').optional().isNumeric(),
    body('step').optional().isNumeric(),
    body('defaultValue').optional(),
    body('allergen').optional().isBoolean()
  ],
  validate, ctrl.create)

router.put('/:id',
  authenticate, authorize('ADMIN','CHEF'),
  [
    param('id').isMongoId(),
    body('name').optional().isString().notEmpty().trim(),
    body('slug').optional().isString().notEmpty().trim(),   // keep optional
    body('type').optional().isIn(['BOOLEAN','PERCENT','CHOICE']),
    body('choices').optional().isArray(),
    body('min').optional().isNumeric(),
    body('max').optional().isNumeric(),
    body('step').optional().isNumeric(),
    body('defaultValue').optional(),
    body('allergen').optional().isBoolean(),
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
