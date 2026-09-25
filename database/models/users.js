'use strict';

const db = require('../db');

exports.getUsers = async () => {
    const res = await db.query('SELECT * FROM users ORDER BY id ASC');
    return res.rows;
};

exports.countUsers = async () => {
    const res = await db.query('SELECT COUNT(*)::int AS total FROM users');
    return res.rows[0].total;
};

exports.getUserById = async (id) => {
    const res = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0];
};

exports.getUserByEmail = async (email) => {
    const res = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0];
};

exports.getUserByIP = async (ip) => {
    const res = await db.query('SELECT * FROM users WHERE registration_ip = $1', [ip]);
    return res.rows[0];
};

exports.createUser = async (name, email, password, registrationIp, role = 'user') => {
    const res = await db.query(
        `INSERT INTO users (name, email, password, registration_ip, role)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, email, password, registrationIp, role]
    );
    return res.rows[0];
};

exports.updateUser = async (id, name, email, registrationIp, role) => {
    const res = await db.query(
        `UPDATE users SET name = $1, email = $2, registration_ip = $3, role = $4
         WHERE id = $5 RETURNING *`,
        [name, email, registrationIp, role, id]
    );
    return res.rows[0];
};

exports.deleteUser = async (id) => {
    const res = await db.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};

exports.toggleUserBlock = async (id, blocked) => {
    const res = await db.query('UPDATE users SET blocked = $1 WHERE id = $2 RETURNING *', [blocked, id]);
    return res.rows[0];
};
