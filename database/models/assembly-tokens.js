'use strict';

const db = require('../db');

const TOKEN_WITH_USER = `
    SELECT t.*, u.name AS user_name, u.email AS user_email
    FROM assembly_tokens t
    LEFT JOIN users u ON t.user_id = u.id`;

exports.getAllAssemblyTokens = async () => {
    const res = await db.query(`${TOKEN_WITH_USER} ORDER BY t.created_at DESC`);
    return res.rows;
};

exports.getAssemblyTokenById = async (id) => {
    const res = await db.query(`${TOKEN_WITH_USER} WHERE t.id = $1`, [id]);
    return res.rows[0];
};

exports.getAssemblyToken = async (userId) => {
    const res = await db.query('SELECT * FROM assembly_tokens WHERE user_id = $1 ORDER BY id ASC LIMIT 1', [userId]);
    return res.rows[0];
};

exports.createAssemblyToken = async (userId, apiKey) => {
    const res = await db.query(
        'INSERT INTO assembly_tokens (user_id, api_key) VALUES ($1, $2) RETURNING *',
        [userId, apiKey]
    );
    return res.rows[0];
};

exports.updateAssemblyToken = async (id, userId, apiKey) => {
    const res = await db.query(
        'UPDATE assembly_tokens SET user_id = $1, api_key = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [userId, apiKey, id]
    );
    return res.rows[0];
};

exports.deleteAssemblyToken = async (id) => {
    const res = await db.query('DELETE FROM assembly_tokens WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};
