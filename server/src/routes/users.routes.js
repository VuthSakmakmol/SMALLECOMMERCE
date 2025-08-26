const router = require('express').Router()
const { body, param, query } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/users.controller')

// all user management is admin-only
router.use(authenticate, authorize('ADMIN'))

router.get('/',
  [
    query('role').optional().isIn(['ADMIN', 'CHEF', 'CUSTOMER']),
    query('q').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 200 })
  ],
  validate,
  ctrl.list
)

router.get('/:id', [param('id').isMongoId()], validate, ctrl.getOne)

router.post('/',
  [
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isString().isLength({ min: 6 }),
    body('role').isIn(['ADMIN', 'CHEF', 'CUSTOMER']),
    body('kitchenId').optional().isString()
  ],
  validate,
  ctrl.create
)

router.put('/:id',
  [
    param('id').isMongoId(),
    body('name').optional().isString().notEmpty(),
    body('email').optional().isEmail(),
    body('role').optional().isIn(['ADMIN', 'CHEF', 'CUSTOMER']),
    body('kitchenId').optional().isString(),
    body('isActive').optional().isBoolean(),
    body('telegramChatId').optional().isString()
  ],
  validate,
  ctrl.update
)

router.patch('/:id/toggle',
  [param('id').isMongoId(), body('value').isBoolean()],
  validate,
  ctrl.toggle
)

router.patch('/:id/password',
  [param('id').isMongoId(), body('password').isString().isLength({ min: 6 })],
  validate,
  ctrl.resetPassword
)

router.delete('/:id', [param('id').isMongoId()], validate, ctrl.removeOne)

module.exports = router
