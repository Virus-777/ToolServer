'use strict';

const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const model = require('../database/model');
const { getSecrets } = require('./auth');
const { USER_ROLES, USER_STATUS } = require('./constants');

/**
 * Register a bearer-token JWT strategy.
 *
 * @param {string} name             Strategy name used by passport.authenticate()
 * @param {object} options
 * @param {string} options.secret   Secret the token must be signed with
 * @param {string} [options.authType]      Required `authType` claim (admin / user)
 * @param {boolean} [options.requireAdmin] Reject users without the admin role
 */
function registerStrategy(name, { secret, authType = null, requireAdmin = false }) {
    const strategyOptions = {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: secret,
    };

    passport.use(name, new JwtStrategy(strategyOptions, async (payload, done) => {
        try {
            if (authType && payload.authType !== authType) {
                return done(null, false, { message: `Invalid token type for ${authType} access` });
            }

            const user = await model.getUserById(payload.id);
            if (!user) {
                return done(null, false);
            }
            if (user.blocked === USER_STATUS.BLOCKED) {
                return done(null, false, { message: 'User is blocked' });
            }
            if (requireAdmin && user.role !== USER_ROLES.ADMIN) {
                return done(null, false, { message: 'Admin privileges required' });
            }

            return done(null, user);
        } catch (error) {
            return done(error, false);
        }
    }));
}

const secrets = getSecrets();

// Dashboard / admin API
registerStrategy('admin-jwt', { secret: secrets.admin, authType: 'admin', requireAdmin: true });
// Client application users
registerStrategy('user-jwt', { secret: secrets.user, authType: 'user' });
// Legacy tokens issued by /api/auth/login
registerStrategy('jwt', { secret: secrets.legacy });

module.exports = passport;
