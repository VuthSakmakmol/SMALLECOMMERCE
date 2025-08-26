const { validationResult } = require('express-validator')

/**
 * Use after express-validator checks.
 * Example: router.post('/login', [body('email').isEmail(), ...], validate, ctrl.login)
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Validation error', errors: errors.array() })
  }
  next()
}

module.exports = { validate }
