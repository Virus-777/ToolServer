'use strict';

const db = require('../db');
const { normalizeUrl } = require('../../utils/url.utils');

exports.getAllBlockListItems = async () => {
    const res = await db.query('SELECT * FROM block_list ORDER BY created_at DESC');
    return res.rows;
};

exports.getBlockListItemById = async (id) => {
    const res = await db.query('SELECT * FROM block_list WHERE id = $1', [id]);
    return res.rows[0];
};

exports.createBlockListItem = async (companyName, url) => {
    const res = await db.query(
        'INSERT INTO block_list (company_name, url) VALUES ($1, $2) RETURNING *',
        [companyName || null, url ? normalizeUrl(url) : null]
    );
    return res.rows[0];
};

exports.updateBlockListItem = async (id, companyName, url) => {
    const res = await db.query(
        'UPDATE block_list SET company_name = $1, url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [companyName || null, url ? normalizeUrl(url) : null, id]
    );
    return res.rows[0];
};

exports.deleteBlockListItem = async (id) => {
    const res = await db.query('DELETE FROM block_list WHERE id = $1 RETURNING *', [id]);
    return res.rows[0];
};

/** True when the company name or the (normalised) URL matches a block-list entry. */
exports.isBlocked = async (company, url) => {
    const conditions = [];
    const params = [];

    if (company) {
        params.push(`%${company}%`);
        conditions.push(`company_name ILIKE $${params.length}`);
    }

    if (url) {
        const normalizedUrl = normalizeUrl(url);
        params.push(normalizedUrl, `%${normalizedUrl}%`);
        conditions.push(`(url = $${params.length - 1} OR url ILIKE $${params.length})`);
    }

    if (conditions.length === 0) {
        return false;
    }

    const res = await db.query(`SELECT 1 FROM block_list WHERE ${conditions.join(' OR ')} LIMIT 1`, params);
    return res.rowCount > 0;
};
