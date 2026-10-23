'use strict';

const crypto = require('crypto');
const { API_TOKEN } = require('../config/constants');

/** Generate a new plaintext token: "<prefix><random hex>". */
function generateApiToken() {
    return `${API_TOKEN.PREFIX}${crypto.randomBytes(API_TOKEN.RANDOM_BYTES).toString('hex')}`;
}

/** Only the hash is persisted; the plaintext is shown once at creation time. */
function hashApiToken(token) {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Short, non-secret identifier shown in the dashboard ("kmj_3f9a0c2b…"). */
function displayPrefix(token) {
    return token.slice(0, API_TOKEN.DISPLAY_PREFIX_LENGTH);
}

/** Cheap syntactic check so JWTs and random strings never hit the database. */
function looksLikeApiToken(value) {
    return typeof value === 'string'
        && value.startsWith(API_TOKEN.PREFIX)
        && value.length === API_TOKEN.PREFIX.length + API_TOKEN.RANDOM_BYTES * 2
        && /^[0-9a-f]+$/.test(value.slice(API_TOKEN.PREFIX.length));
}

/**
 * Pull the credential out of a request. Clients may send either
 *   Authorization: Bearer <token>   or   X-API-Key: <token>
 */
function extractApiToken(req) {
    const apiKeyHeader = req.headers['x-api-key'];
    if (typeof apiKeyHeader === 'string' && apiKeyHeader.trim()) {
        return apiKeyHeader.trim();
    }
    const authorization = req.headers.authorization;
    if (typeof authorization === 'string') {
        const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
        if (match) {
            return match[1].trim();
        }
    }
    return null;
}

const isExpired = (row, now = Date.now()) => Boolean(row.expires_at) && new Date(row.expires_at).getTime() <= now;

/** "active" | "revoked" | "expired" for a stored token row. */
function tokenStatus(row, now = Date.now()) {
    if (row.revoked_at) {
        return 'revoked';
    }
    if (isExpired(row, now)) {
        return 'expired';
    }
    return 'active';
}

module.exports = {
    generateApiToken,
    hashApiToken,
    displayPrefix,
    looksLikeApiToken,
    extractApiToken,
    tokenStatus,
};
