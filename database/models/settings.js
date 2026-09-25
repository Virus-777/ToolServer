'use strict';

const db = require('../db');

exports.getSettings = async () => {
    const res = await db.query('SELECT * FROM settings ORDER BY created_at DESC');
    return res.rows;
};

exports.getSettingById = async (id) => {
    const res = await db.query('SELECT * FROM settings WHERE id = $1', [id]);
    return res.rows[0];
};

exports.getSettingByKey = async (key) => {
    const res = await db.query('SELECT * FROM settings WHERE key = $1', [key]);
    return res.rows[0];
};

exports.createSetting = async (key, value) => {
    const res = await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) RETURNING *', [key, value]);
    return res.rows[0];
};

exports.updateSetting = async (id, key, value) => {
    const res = await db.query('UPDATE settings SET key = $1, value = $2 WHERE id = $3 RETURNING *', [key, value, id]);
    return res.rows[0];
};

exports.deleteSetting = async (id) => {
    const res = await db.query('DELETE FROM settings WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};

/** Create the setting when missing, otherwise overwrite its value. */
exports.setSettingValue = async (key, value) => {
    const existing = await exports.getSettingByKey(key);
    if (existing) {
        return exports.updateSetting(existing.id, key, value);
    }
    return exports.createSetting(key, value);
};
