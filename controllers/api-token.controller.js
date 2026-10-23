'use strict';

const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { generateApiToken, hashApiToken, displayPrefix, tokenStatus } = require('../utils/api-token');
const { HISTORY_ACTIONS, HISTORY_ENTITIES, API_TOKEN } = require('../config/constants');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Public shape of a token row (never includes the hash). */
const presentToken = (row) => ({
    id: row.id,
    name: row.name,
    token_prefix: row.token_prefix,
    created_by: row.created_by,
    created_by_name: row.created_by_name || null,
    created_by_email: row.created_by_email || null,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at,
    last_used_at: row.last_used_at,
    created_at: row.created_at,
    status: tokenStatus(row),
});

/**
 * Validate `expires_in_days` from the request body.
 * Returns { expiresAt } (null = never expires) or { error }.
 */
const parseExpiry = (value) => {
    if (value === undefined || value === null || value === '' || Number(value) === 0) {
        return { expiresAt: null };
    }
    const days = Number(value);
    if (!Number.isInteger(days) || days < 1 || days > API_TOKEN.MAX_EXPIRES_IN_DAYS) {
        return { error: `expires_in_days must be a whole number between 1 and ${API_TOKEN.MAX_EXPIRES_IN_DAYS}` };
    }
    return { expiresAt: new Date(Date.now() + days * ONE_DAY_MS) };
};

exports.getAllApiTokens = async (req, res) => {
    try {
        const tokens = await model.getAllApiTokens();
        res.status(200).json({ tokens: tokens.map(presentToken) });
    } catch (error) {
        console.error('Get all API tokens error:', error);
        handleError(res, 500, 'Error fetching API tokens');
    }
};

exports.getApiToken = async (req, res) => {
    try {
        const token = await model.getApiTokenById(req.params.id);
        if (!token) {
            return handleError(res, 404, 'API token not found');
        }
        res.status(200).json({ token: presentToken(token) });
    } catch (error) {
        console.error('Get API token error:', error);
        handleError(res, 500, 'Error fetching API token');
    }
};

/**
 * Generate a token. The plaintext is returned exactly once in this response;
 * only its hash is stored.
 */
exports.createApiToken = async (req, res) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
        return handleError(res, 400, 'Name is required');
    }
    if (name.length > API_TOKEN.NAME_MAX_LENGTH) {
        return handleError(res, 400, `Name must be at most ${API_TOKEN.NAME_MAX_LENGTH} characters`);
    }

    const { expiresAt, error } = parseExpiry(req.body.expires_in_days);
    if (error) {
        return handleError(res, 400, error);
    }

    try {
        const plaintext = generateApiToken();
        const row = await model.createApiToken({
            name,
            tokenHash: hashApiToken(plaintext),
            tokenPrefix: displayPrefix(plaintext),
            createdBy: req.user ? req.user.id : null,
            expiresAt,
        });

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.API_TOKEN,
            entityId: row.id,
            description: `API token generated: ${name}`,
            metadata: { name, token_prefix: row.token_prefix, expires_at: expiresAt },
        });

        res.status(201).json({
            message: 'API token generated. Copy it now: it will not be shown again.',
            token: plaintext,
            api_token: presentToken({
                ...row,
                created_by_name: req.user ? req.user.name : null,
                created_by_email: req.user ? req.user.email : null,
            }),
        });
    } catch (error) {
        console.error('Create API token error:', error);
        handleError(res, 500, 'Error generating API token');
    }
};

exports.revokeApiToken = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await model.getApiTokenById(id);
        if (!existing) {
            return handleError(res, 404, 'API token not found');
        }
        if (existing.revoked_at) {
            return handleError(res, 400, 'API token is already revoked');
        }

        await model.revokeApiToken(id);
        const updated = (await model.getApiTokenById(id)) || { ...existing, revoked_at: new Date() };

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.API_TOKEN,
            entityId: id,
            description: `API token revoked: ${existing.name}`,
            metadata: { name: existing.name, token_prefix: existing.token_prefix },
        });

        res.status(200).json({ message: 'API token revoked', token: presentToken(updated) });
    } catch (error) {
        console.error('Revoke API token error:', error);
        handleError(res, 500, 'Error revoking API token');
    }
};

exports.deleteApiToken = async (req, res) => {
    const { id } = req.params;

    try {
        const existing = await model.getApiTokenById(id);
        if (!existing) {
            return handleError(res, 404, 'API token not found');
        }

        await model.deleteApiToken(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.API_TOKEN,
            entityId: id,
            description: `API token deleted: ${existing.name}`,
            metadata: { name: existing.name, token_prefix: existing.token_prefix },
        });

        res.status(200).json({ message: 'API token deleted' });
    } catch (error) {
        console.error('Delete API token error:', error);
        handleError(res, 500, 'Error deleting API token');
    }
};
