'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const passport = require('./config/passport');
const db = require('./database/db');
const { handleError } = require('./utils/utils');

// NOTE: the environment must be loaded (config/env.js) before this module is required.

const API_ROUTERS = {
    '/api/auth': require('./routers/auth.router'),                     // legacy auth + user management
    '/api/admin': require('./routers/admin-auth.router'),              // dashboard authentication
    '/api/user': require('./routers/user-auth.router'),                // client application authentication
    '/api/ips': require('./routers/ip-lookup.router'),
    '/api/gpt': require('./routers/gpt.router'),
    '/api/config': require('./routers/config.router'),
    '/api/jobs': require('./routers/job.router'),
    '/api/settings': require('./routers/settings.router'),
    '/api/block-list': require('./routers/block-list.router'),
    '/api/history': require('./routers/history.router'),
    '/api/allowed-emails': require('./routers/allowed-email.router'),
    '/api/assembly-tokens': require('./routers/assembly-token.router'),
};

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** CORS_ORIGIN="https://a.com,https://b.com" -> array; unset -> allow any origin */
function parseCorsOrigin(value) {
    if (!value || value.trim() === '' || value.trim() === '*') {
        return '*';
    }
    return value.split(',').map((origin) => origin.trim()).filter(Boolean);
}

/** Vite emits hashed file names under /assets, so those can be cached forever. */
function setStaticCacheHeaders(res, filePath) {
    if (/[\\/]assets[\\/]/.test(filePath)) {
        res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR_SECONDS}, immutable`);
    }
}

async function healthCheck(req, res) {
    try {
        await db.query('SELECT 1');
        res.status(200).json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
    } catch (error) {
        res.status(503).json({ status: 'error', database: 'down' });
    }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    // Errors raised by the body parsers carry a status and a `type`
    if (err.type === 'entity.too.large') {
        return handleError(res, 413, 'Request body too large');
    }
    if (err.type === 'entity.parse.failed') {
        return handleError(res, 400, 'Invalid JSON body');
    }
    if (err.status && err.status >= 400 && err.status < 500) {
        return handleError(res, err.status, err.message);
    }

    console.error(err.stack || err);
    handleError(res, 500, 'Something went wrong!');
}

function createApp() {
    const app = express();
    const publicDir = path.join(__dirname, 'public');
    const bodyLimit = process.env.BODY_LIMIT || '500kb';

    app.disable('x-powered-by');
    app.use(passport.initialize());
    app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
    app.use(cors({ origin: parseCorsOrigin(process.env.CORS_ORIGIN) }));
    app.use(express.json({ limit: bodyLimit }));
    app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

    // API
    app.get('/api/health', healthCheck);
    for (const [prefix, router] of Object.entries(API_ROUTERS)) {
        app.use(prefix, router);
    }
    app.use('/api', (req, res) => handleError(res, 404, 'Route not found'));

    // Built dashboard (frontend/ -> public/)
    app.use(express.static(publicDir, { index: false, setHeaders: setStaticCacheHeaders }));

    // Client-side routing: every other GET serves the SPA shell
    app.use((req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            return handleError(res, 404, 'Not found');
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(publicDir, 'index.html'));
    });

    app.use(errorHandler);

    return app;
}

module.exports = { createApp };
