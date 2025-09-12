const express = require('express')
const router = express.Router()
const ctrl = require('../controllers/users.controller')
const { authenticate, authorize } = require('../middleware/auth')

router.get('/', authenticate, authorize('ADMIN'), ctrl.list)
router.get('/:id', authenticate, authorize('ADMIN'), ctrl.getOne)
router.post('/', authenticate, authorize('ADMIN'), ctrl.create)
router.put('/:id', authenticate, authorize('ADMIN'), ctrl.update)
router.patch('/:id/password', authenticate, authorize('ADMIN'), ctrl.resetPassword)
router.patch('/:id/toggle', authenticate, authorize('ADMIN'), ctrl.toggle)
router.delete('/:id', authenticate, authorize('ADMIN'), ctrl.removeOne)
router.post('/bulk-import', authenticate, authorize('ADMIN'), ctrl.bulkImport)

module.exports = router
