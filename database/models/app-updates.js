'use strict';

const db = require('../db');

// Newest release first: versions are dotted numeric strings (see utils/version.utils.js)
const ORDER_BY_VERSION_DESC = `ORDER BY string_to_array(version, '.')::int[] DESC, created_at DESC`;

exports.getAppUpdates = async (appName) => {
    const res = await db.query(`SELECT * FROM app_updates WHERE app_name = $1 ${ORDER_BY_VERSION_DESC}`, [appName]);
    return res.rows;
};

exports.getLatestAppUpdate = async (appName) => {
    const res = await db.query(`SELECT * FROM app_updates WHERE app_name = $1 ${ORDER_BY_VERSION_DESC} LIMIT 1`, [appName]);
    return res.rows[0];
};

exports.getAppUpdateById = async (id) => {
    const res = await db.query('SELECT * FROM app_updates WHERE id = $1', [id]);
    return res.rows[0];
};

exports.getAppUpdateByVersion = async (appName, version) => {
    const res = await db.query('SELECT * FROM app_updates WHERE app_name = $1 AND version = $2', [appName, version]);
    return res.rows[0];
};

exports.createAppUpdate = async ({ appName, version, changelog, fileName, storedName, fileSize, sha256, mandatory }) => {
    const res = await db.query(
        `INSERT INTO app_updates (app_name, version, changelog, file_name, stored_name, file_size, sha256, mandatory)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [appName, version, changelog, fileName, storedName, fileSize, sha256, mandatory]
    );
    return res.rows[0];
};

/** Only the release notes and the mandatory flag are editable; the file and version are immutable. */
exports.updateAppUpdate = async (id, { changelog, mandatory }) => {
    const res = await db.query(
        `UPDATE app_updates
         SET changelog = $1, mandatory = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [changelog, mandatory, id]
    );
    return res.rows[0];
};

exports.deleteAppUpdate = async (id) => {
    const res = await db.query('DELETE FROM app_updates WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};

exports.incrementAppUpdateDownloads = async (id) => {
    await db.query('UPDATE app_updates SET download_count = download_count + 1 WHERE id = $1', [id]);
};
