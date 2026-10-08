'use strict';

const db = require('../db');

// Ordering here is only a stable fallback; semver ordering is done in code (controllers/app-release.controller.js)

exports.getAppReleases = async () => {
    const res = await db.query('SELECT * FROM app_releases ORDER BY created_at DESC, id DESC');
    return res.rows;
};

exports.getPublishedAppReleases = async (target, arch) => {
    const res = await db.query(
        'SELECT * FROM app_releases WHERE target = $1 AND arch = $2 AND published = TRUE',
        [target, arch]
    );
    return res.rows;
};

exports.getAppReleaseById = async (id) => {
    const res = await db.query('SELECT * FROM app_releases WHERE id = $1', [id]);
    return res.rows[0];
};

exports.getAppReleaseByVersion = async (target, arch, version) => {
    const res = await db.query(
        'SELECT * FROM app_releases WHERE target = $1 AND arch = $2 AND version = $3',
        [target, arch, version]
    );
    return res.rows[0];
};

exports.createAppRelease = async ({ version, notes, pubDate, target, arch, fileName, signature, sha256, size, published }) => {
    const res = await db.query(
        `INSERT INTO app_releases (version, notes, pub_date, target, arch, file_name, signature, sha256, size, published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [version, notes, pubDate, target, arch, fileName, signature, sha256, size, published]
    );
    return res.rows[0];
};

/** Only the published flag and the notes are editable. */
exports.updateAppRelease = async (id, { published, notes }) => {
    const res = await db.query(
        `UPDATE app_releases
         SET published = $1, notes = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [published, notes, id]
    );
    return res.rows[0];
};

exports.deleteAppRelease = async (id) => {
    const res = await db.query('DELETE FROM app_releases WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};
