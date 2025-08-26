const router = require('express').Router()

router.get('/health', (req, res) => res.json({ ok: true, scope: 'orders' }))

module.exports = router
