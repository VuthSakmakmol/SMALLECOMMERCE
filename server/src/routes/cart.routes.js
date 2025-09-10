// routes/cart.js
const router = require('express').Router()
const { body, param } = require('express-validator')
const { validate } = require('../middleware/validate')
// If you want auth: const { authenticate } = require('../middleware/auth')

const ctrl = require('../controllers/cart.controller')

// router.use(authenticate) // optional; or pass x-guest-id header

router.get('/', ctrl.getCart)

router.post('/items',
  [
    body('foodId').isMongoId(),
    body('qty').optional().isInt({ min: 1 }),
    body('ingredients').optional().isArray(),
    body('groups').optional().isArray()
  ],
  validate, ctrl.addItem)

router.put('/items/:itemId',
  [
    param('itemId').isMongoId(),
    body('qty').optional().isInt({ min: 1 }),
    body('ingredients').optional().isArray(),
    body('groups').optional().isArray()
  ],
  validate, ctrl.updateItem)

router.delete('/items/:itemId',
  [ param('itemId').isMongoId() ],
  validate, ctrl.removeItem)

router.delete('/', ctrl.clear)

module.exports = router
