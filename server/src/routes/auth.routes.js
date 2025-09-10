// routes/auth.js
const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/auth.controller')
const { authenticate } = require('../middleware/auth')

router.post('/register', ctrl.registerEmployee)     // employee self-register
router.post('/register-guest', ctrl.registerGuest)  // guest register
router.post('/login', ctrl.login)                   // { id, password }
router.get('/me', authenticate, ctrl.me)

module.exports = router
