'use strict';

const { Pool } = require('pg');

// NOTE: the environment must be loaded (config/env.js) before this module is required.
const pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    max: Number(process.env.PG_POOL_MAX) || 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS) || 5000,
});

// An idle client can error when the database restarts. The pool discards the
// broken client on its own, so log it instead of killing the whole server.
pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), // for transactions
    end: () => pool.end(),           // graceful shutdown
};
