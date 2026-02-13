const express = require('express');
const { userLogin, userRegister, userVerify, getAssemblyToken, createAssemblyToken } = require('../controllers/user-auth.controller');
const { validateLogin, validateRegister, authenticateUser, authenticate } = require('../utils/auth.middleware');
const router = express.Router();

// User authentication routes
router.route('/login')
    .post(validateLogin, userLogin);

router.route('/register')
    .post(validateRegister, userRegister);

// User token verification route (requires user authentication)
router.route('/verify')
    .get(authenticateUser, userVerify);

router.route('/assembly-token')
    .get(authenticate, getAssemblyToken)
    .post(authenticate, createAssemblyToken);

module.exports = router;
