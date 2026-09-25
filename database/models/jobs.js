'use strict';

const db = require('../db');
const { normalizeUrl } = require('../../utils/url.utils');

// Columns matched by the free-text search
const SEARCHABLE_COLUMNS = ['title', 'company', 'tech', 'summary', 'description'];

/** Build the WHERE clause + parameters shared by the list and count queries. */
function buildFilters({ date, industry, search }) {
    const conditions = [];
    const params = [];

    if (date) {
        params.push(date);
        conditions.push(`date = $${params.length}`);
    }

    if (industry !== null && industry !== undefined && industry !== '') {
        params.push(parseInt(industry, 10));
        conditions.push(`industry = $${params.length}`);
    }

    if (search) {
        params.push(`%${search}%`);
        const placeholder = `$${params.length}`;
        conditions.push(`(${SEARCHABLE_COLUMNS.map((column) => `${column} ILIKE ${placeholder}`).join(' OR ')})`);
    }

    return {
        where: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
        params,
    };
}

/**
 * Paginated job listing.
 * @param {object} options
 * @param {string|null} [options.date]           YYYY-MM-DD
 * @param {number} [options.page]
 * @param {number} [options.limit]
 * @param {string|null} [options.search]
 * @param {'ASC'|'DESC'} [options.orderDirection]
 * @param {number|null} [options.industry]
 */
exports.getJobs = async ({ date = null, page = 1, limit = 20, search = null, orderDirection = 'ASC', industry = null } = {}) => {
    const { where, params } = buildFilters({ date, industry, search });
    const direction = String(orderDirection).toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const offset = (page - 1) * limit;

    const [jobsRes, countRes] = await Promise.all([
        db.query(
            `SELECT * FROM jobs${where} ORDER BY id ${direction} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
            [...params, limit, offset]
        ),
        db.query(`SELECT COUNT(*)::int AS total FROM jobs${where}`, params),
    ]);

    const total = countRes.rows[0].total;

    return {
        jobs: jobsRes.rows,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

exports.getJobsByDate = async (date, industry = null) => {
    const { where, params } = buildFilters({ date, industry });
    const res = await db.query(`SELECT * FROM jobs${where} ORDER BY id ASC`, params);
    return res.rows;
};

exports.getJobById = async (jobId) => {
    const res = await db.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    return res.rows[0];
};

exports.getJobByUrl = async (url) => {
    const res = await db.query('SELECT * FROM jobs WHERE url = $1', [url]);
    return res.rows[0];
};

exports.getJobByNormalizedUrl = async (url) => {
    const res = await db.query('SELECT * FROM jobs WHERE normalized_url = $1', [normalizeUrl(url)]);
    return res.rows[0];
};

exports.createJob = async ({ title, company, tech, url, summary, description, date, industry = 0 }) => {
    const normalizedUrl = url ? normalizeUrl(url) : null;
    const res = await db.query(
        `INSERT INTO jobs (title, company, tech, url, normalized_url, summary, description, date, industry)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [title, company, tech, url, normalizedUrl, summary, description, date, industry]
    );
    return res.rows[0];
};

exports.updateJob = async (jobId, { title, company, date, tech, url, summary, description, industry = 0 }) => {
    const normalizedUrl = url ? normalizeUrl(url) : null;
    const res = await db.query(
        `UPDATE jobs
         SET title = $1, company = $2, date = $3, tech = $4, url = $5, normalized_url = $6,
             summary = $7, description = $8, industry = $9, updated_at = CURRENT_TIMESTAMP
         WHERE id = $10 RETURNING *`,
        [title, company, date, tech, url, normalizedUrl, summary, description, industry, jobId]
    );
    return res.rows[0];
};

exports.deleteJob = async (jobId) => {
    const res = await db.query('DELETE FROM jobs WHERE id = $1 RETURNING *', [jobId]);
    return res.rows[0];
};

exports.deleteJobsByDate = async (date) => {
    const res = await db.query('DELETE FROM jobs WHERE date = $1 RETURNING *', [date]);
    return res.rows;
};
