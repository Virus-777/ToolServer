'use strict';

const db = require('../db');

exports.getAllowedEmails = async () => {
    const res = await db.query('SELECT * FROM allowed_emails ORDER BY created_at DESC');
    return res.rows;
};

exports.getAllowedEmailById = async (id) => {
    const res = await db.query('SELECT * FROM allowed_emails WHERE id = $1', [id]);
    return res.rows[0];
};

exports.getAllowedEmailByEmail = async (email) => {
    const res = await db.query('SELECT * FROM allowed_emails WHERE email = $1', [email]);
    return res.rows[0];
};

exports.createAllowedEmail = async (email) => {
    const res = await db.query('INSERT INTO allowed_emails (email) VALUES ($1) RETURNING *', [email]);
    return res.rows[0];
};

exports.updateAllowedEmail = async (id, email) => {
    const res = await db.query(
        'UPDATE allowed_emails SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [email, id]
    );
    return res.rows[0];
};

exports.deleteAllowedEmail = async (id) => {
    const res = await db.query('DELETE FROM allowed_emails WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};

exports.isEmailAllowed = async (email) => {
    const res = await db.query('SELECT 1 FROM allowed_emails WHERE email = $1 LIMIT 1', [email]);
    return res.rowCount > 0;
};
