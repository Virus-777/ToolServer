'use strict';

const passport = require('../config/passport');
const model = require('../database/model');
const { handleError } = require('./utils');

exports.validateRegister = (req, res, next) => {
    const { name, email, password, confirm_password } = req.body;

    if (!name) {
        return handleError(res, 400, 'Name field is required.');
    }
    if (!email) {
        return handleError(res, 400, 'Email field is required.');
    }
    if (!email.includes('@')) {
        return handleError(res, 400, 'Please enter a valid email.');
    }
    if (!password) {
        return handleError(res, 400, 'Password field is required.');
    }
    if (!confirm_password) {
        return handleError(res, 400, 'You must confirm your password.');
    }
    if (password !== confirm_password) {
        return handleError(res, 400, 'Your password does not match.');
    }

    next();
};

exports.validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
        return handleError(res, 400, 'Email field is required.');
    }
    if (!email.includes('@')) {
        return handleError(res, 400, 'Please enter a valid email.');
    }
    if (!password) {
        return handleError(res, 400, 'Password field is required.');
    }

    next();
};

// Legacy tokens (issued by /api/auth/login)
exports.authenticate = passport.authenticate('jwt', { session: false });

// Dashboard / admin tokens (issued by /api/admin/login)
exports.authenticateAdmin = passport.authenticate('admin-jwt', { session: false });

// Client application tokens (issued by /api/user/login)
exports.authenticateUser = passport.authenticate('user-jwt', { session: false });

/**
 * Reject authenticated users whose email has been removed from the allowed list.
 * Must run after one of the authenticate* middlewares.
 */
exports.requireAllowedEmail = async (req, res, next) => {
    try {
        if (req.user && req.user.email) {
            const allowed = await model.isEmailAllowed(req.user.email);
            if (!allowed) {
                return handleError(res, 403, 'Your email is not in the allowed list. Please contact an administrator.');
            }
        }
        next();
    } catch (error) {
        next(error);
    }
};
