'use strict';

const passport = require('../config/passport');
const model = require('../database/model');
const { handleError } = require('./utils');
const { extractApiToken, looksLikeApiToken, hashApiToken, tokenStatus } = require('./api-token');

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

/**
 * Guard for the jobs feed consumed by other applications.
 *
 * Accepts, in this order:
 *   1. an API token generated on the dashboard (Authorization: Bearer / X-API-Key)
 *   2. a dashboard admin session (admin JWT), so the dashboard itself keeps working
 *
 * On success `req.apiToken` holds the matching token row (case 1) or `req.user`
 * the admin (case 2).
 */
exports.authenticateJobsApi = async (req, res, next) => {
    const credential = extractApiToken(req);

    if (!credential) {
        return handleError(res, 401, 'API token required. Send it as "Authorization: Bearer <token>" or "X-API-Key: <token>".');
    }

    if (looksLikeApiToken(credential)) {
        try {
            const row = await model.getApiTokenByHash(hashApiToken(credential));
            if (!row) {
                return handleError(res, 401, 'Invalid API token');
            }
            const status = tokenStatus(row);
            if (status !== 'active') {
                return handleError(res, 401, `API token has been ${status}`);
            }
            req.apiToken = row;
            // Best effort: a failed bookkeeping write must not fail the request
            Promise.resolve(model.touchApiToken(row.id)).catch((error) => {
                console.error('Failed to update API token usage:', error.message);
            });
            return next();
        } catch (error) {
            return next(error);
        }
    }

    // Not an API token: fall back to the dashboard session
    return passport.authenticate('admin-jwt', { session: false }, (error, user) => {
        if (error) {
            return next(error);
        }
        if (!user) {
            return handleError(res, 401, 'Invalid API token');
        }
        req.user = user;
        return next();
    })(req, res, next);
};
