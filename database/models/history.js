'use strict';

const db = require('../db');

exports.createHistoryLog = async (userId, userEmail, actionType, entityType, entityId, description, ipAddress, metadata = null) => {
    const res = await db.query(
        `INSERT INTO history (user_id, user_email, action_type, entity_type, entity_id, description, ip_address, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [userId, userEmail, actionType, entityType, entityId, description, ipAddress, metadata ? JSON.stringify(metadata) : null]
    );
    return res.rows[0];
};

/**
 * Paginated audit log, newest first.
 * @param {object} options
 * @param {number} [options.page]
 * @param {number} [options.limit]
 * @param {number|string|null} [options.userId]
 * @param {string|null} [options.actionType]
 * @param {string|null} [options.entityType]
 */
exports.getHistoryLogs = async ({ page = 1, limit = 50, userId = null, actionType = null, entityType = null } = {}) => {
    const conditions = [];
    const params = [];

    if (userId) {
        params.push(userId);
        conditions.push(`user_id = $${params.length}`);
    }
    if (actionType) {
        params.push(actionType);
        conditions.push(`action_type = $${params.length}`);
    }
    if (entityType) {
        params.push(entityType);
        conditions.push(`entity_type = $${params.length}`);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    const [logsRes, countRes] = await Promise.all([
        db.query(
            `SELECT * FROM history${where} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        ),
        db.query(`SELECT COUNT(*)::int AS total FROM history${where}`, params),
    ]);

    const total = countRes.rows[0].total;

    return {
        logs: logsRes.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getHistoryLogById = async (id) => {
    const res = await db.query('SELECT * FROM history WHERE id = $1', [id]);
    return res.rows[0];
};
