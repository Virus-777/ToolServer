'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

/**
 * Authentication configuration: JWT secrets/signing and password hashing.
 *
 * Signing and verification MUST resolve to the same secret. The previous
 * implementation signed admin/user tokens with `JWT_*_SECRET || JWT_SECRET`
 * but verified them with `JWT_*_SECRET || <built-in default>`, which broke
 * every dashboard login as soon as only JWT_SECRET was configured (the
 * default .env layout).
 *
 * Resolution order (first defined value wins):
 *   admin : JWT_ADMIN_SECRET -> JWT_SECRET -> built-in default
 *   user  : JWT_USER_SECRET  -> JWT_SECRET -> built-in default
 *   legacy: JWT_SECRET       -> built-in default
 *
 * The built-in defaults are unchanged from earlier releases so tokens issued by
 * existing deployments keep validating.
 */
const DEFAULT_SECRETS = Object.freeze({
    admin: '75b97d33464a2b2474421f0e033fb23a6bb198f0d5ac63609e000c32443759e73b49e80596ca279e712a5443f0fa967ec0beafef5382fd85a5d91d862a22632f',
    user: 'a29f1a79fd0558c6883cfe65a1aa1d81b19056f35275ba2c3985b6684eedcc165c23511613b3c0c43cfe0e092ad97fbb4f072a2189e151033234e2e0bf5b2767',
    legacy: 'your-secret-key',
});

const DEFAULT_EXPIRES_IN = '24h';
const DEFAULT_BCRYPT_ROUNDS = 10;

let cached = null;

/**
 * Resolve secrets lazily so the module can be required before the environment
 * is loaded (e.g. by tooling) without freezing empty values.
 */
function getSecrets() {
    if (cached) {
        return cached;
    }

    const env = process.env;
    cached = Object.freeze({
        admin: env.JWT_ADMIN_SECRET || env.JWT_SECRET || DEFAULT_SECRETS.admin,
        user: env.JWT_USER_SECRET || env.JWT_SECRET || DEFAULT_SECRETS.user,
        legacy: env.JWT_SECRET || DEFAULT_SECRETS.legacy,
        expiresIn: env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN,
    });

    if (!env.JWT_SECRET && !env.JWT_ADMIN_SECRET) {
        console.warn('⚠️  JWT_SECRET / JWT_ADMIN_SECRET are not set - using built-in defaults. Set them for production.');
    }

    return cached;
}

const signAdminToken = (user) => {
    const { admin, expiresIn } = getSecrets();
    return jwt.sign({ id: user.id, email: user.email, role: 'admin', authType: 'admin' }, admin, { expiresIn });
};

const signUserToken = (user) => {
    const { user: secret, expiresIn } = getSecrets();
    return jwt.sign({ id: user.id, email: user.email, role: user.role, authType: 'user' }, secret, { expiresIn });
};

const signLegacyToken = (user) => {
    const { legacy, expiresIn } = getSecrets();
    return jwt.sign({ id: user.id, email: user.email }, legacy, { expiresIn });
};

const hashPassword = (password) => {
    const rounds = Number(process.env.BCRYPT_SALT_ROUNDS) || DEFAULT_BCRYPT_ROUNDS;
    return bcrypt.hash(password, rounds);
};

const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

module.exports = {
    getSecrets,
    signAdminToken,
    signUserToken,
    signLegacyToken,
    hashPassword,
    verifyPassword,
};
