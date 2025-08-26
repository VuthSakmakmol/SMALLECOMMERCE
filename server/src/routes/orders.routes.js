const router = require('express').Router()
const { body, query, param } = require('express-validator')
const { authenticate, authorize } = require('../middleware/auth')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/orders.controller')

// list (Admin/Chef for their scope; Customer sees own)
router.get('/',
  authenticate,
  [
    query('scope').optional().isIn(['ADMIN','CHEF','CUSTOMER']),
    query('status').optional().isIn(['PENDING','ACCEPTED','COOKING','READY','DELIVERED','CANCELED'])
  ],
  validate,
  ctrl.list
)

// create (Customer or Admin)
router.post('/',
  authenticate, authorize('ADMIN','CUSTOMER'),
  [ body('items').isArray({ min: 1 }) ],
  validate,
  ctrl.create
)

router.get('/:id', authenticate, [param('id').isMongoId()], validate, ctrl.getOne)


// chef/admin transitions
router.patch('/:id/accept',  authenticate, authorize('CHEF','ADMIN'), [param('id').isMongoId()], validate, ctrl.accept)
router.patch('/:id/start',   authenticate, authorize('CHEF','ADMIN'), [param('id').isMongoId()], validate, ctrl.start)
router.patch('/:id/ready',   authenticate, authorize('CHEF','ADMIN'), [param('id').isMongoId()], validate, ctrl.ready)

// delivered: chef/admin, OR customer for own order
router.patch('/:id/deliver', authenticate, [param('id').isMongoId()], validate, ctrl.deliver)

module.exports = router
