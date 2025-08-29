const router = require('express').Router()
const { body } = require('express-validator')
const { validate } = require('../middleware/validate')
const ctrl = require('../controllers/auth.controller')

router.post(
  '/register',
  [ body('username').isString().notEmpty(), body('password').isString().isLength({ min: 6 }) ],
  validate,
  ctrl.registerCustomer
)

router.post(
  '/login',
  [ body('username').isString().notEmpty(), body('password').isString().isLength({ min: 6 }) ],
  validate,
  ctrl.login
)

const { authenticate } = require('../middleware/auth')
router.get('/me', authenticate, ctrl.me)

module.exports = router
