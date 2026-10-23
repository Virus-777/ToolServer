'use strict';

const db = require('../db');

/**
 * API tokens that grant other applications access to the jobs feed.
 *
 * Only a SHA-256 hash of the token is stored; the plaintext is shown once at
 * creation time. `token_prefix` keeps the first characters so a token can be
 * recognised in the dashboard without revealing it.
 */

const TOKEN_WITH_USER = `
    SELECT t.id, t.name, t.token_prefix, t.created_by, t.expires_at, t.revoked_at, t.last_used_at, t.created_at,
           u.name AS created_by_name, u.email AS created_by_email
    FROM api_tokens t
    LEFT JOIN users u ON t.created_by = u.id`;

exports.getAllApiTokens = async () => {
    const res = await db.query(`${TOKEN_WITH_USER} ORDER BY t.created_at DESC`);
    return res.rows;
};

exports.getApiTokenById = async (id) => {
    const res = await db.query(`${TOKEN_WITH_USER} WHERE t.id = $1`, [id]);
    return res.rows[0];
};

/** Lookup used on every authenticated request; returns the raw row (no join). */
exports.getApiTokenByHash = async (tokenHash) => {
    const res = await db.query('SELECT * FROM api_tokens WHERE token_hash = $1', [tokenHash]);
    return res.rows[0];
};

exports.createApiToken = async ({ name, tokenHash, tokenPrefix, createdBy, expiresAt }) => {
    const res = await db.query(
        `INSERT INTO api_tokens (name, token_hash, token_prefix, created_by, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, token_prefix, created_by, expires_at, revoked_at, last_used_at, created_at`,
        [name, tokenHash, tokenPrefix, createdBy, expiresAt]
    );
    return res.rows[0];
};

exports.revokeApiToken = async (id) => {
    const res = await db.query(
        `UPDATE api_tokens SET revoked_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND revoked_at IS NULL
         RETURNING id, name, token_prefix, created_by, expires_at, revoked_at, last_used_at, created_at`,
        [id]
    );
    return res.rows[0];
};

exports.touchApiToken = async (id) => {
    await db.query('UPDATE api_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
};

exports.deleteApiToken = async (id) => {
    const res = await db.query('DELETE FROM api_tokens WHERE id = $1 RETURNING id, name, token_prefix', [id]);
    return res.rows[0];
};
