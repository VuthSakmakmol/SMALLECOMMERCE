const router = require('express').Router()
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')
const { authenticate, authorize } = require('../middleware/auth')
const ctrl = require('../controllers/auth.controller')
const { ROLES } = require('../models/User')

// Public login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isString().isLength({ min: 6 }).withMessage('Password min 6 chars')
  ],
  validate,
  ctrl.login
)

// Admin creates any user (ADMIN, CHEF, CUSTOMER)
router.post(
  '/register',
  authenticate,
  authorize('ADMIN'),
  [
    body('name').isString().notEmpty(),
    body('email').isEmail(),
    body('password').isString().isLength({ min: 6 }),
    body('role').optional().isIn(ROLES),
    body('kitchenId').optional().isString()
  ],
  validate,
  ctrl.register
)

// Return current user (requires token)
router.get('/me', authenticate, ctrl.me)

module.exports = router
