'use strict';

/**
 * API token tests (node:test, no database required).
 *
 * Covers the dashboard endpoints that generate / revoke / delete tokens and the
 * guard on the job list endpoints (GET /api/jobs, GET /api/jobs/today).
 *
 *   npm test
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');

process.env.NODE_ENV = 'test';

/* ---------- in-memory data layer ---------- */

const store = {
    nextId: 1,
    tokens: [],
    users: {
        1: { id: 1, name: 'Admin', email: 'admin@test.local', role: 'admin', blocked: 1 },
        2: { id: 2, name: 'User', email: 'user@test.local', role: 'user', blocked: 1 },
    },
};

const withUser = (row) => {
    if (!row) return undefined;
    const user = store.users[row.created_by] || {};
    return { ...row, created_by_name: user.name || null, created_by_email: user.email || null };
};

const fakeModel = {
    getUserById: async (id) => store.users[id] || null,
    isEmailAllowed: async () => true,
    createHistoryLog: async () => {},
    getJobs: async () => ({ jobs: [{ id: 1, title: 'Dev' }], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    getJobsByDate: async () => [{ id: 1, title: 'Dev' }],

    getAllApiTokens: async () => store.tokens.map(withUser),
    getApiTokenById: async (id) => withUser(store.tokens.find((t) => t.id === Number(id))),
    getApiTokenByHash: async (hash) => store.tokens.find((t) => t.token_hash === hash),
    createApiToken: async ({ name, tokenHash, tokenPrefix, createdBy, expiresAt }) => {
        const row = {
            id: store.nextId++,
            name,
            token_hash: tokenHash,
            token_prefix: tokenPrefix,
            created_by: createdBy,
            expires_at: expiresAt,
            revoked_at: null,
            last_used_at: null,
            created_at: new Date(),
        };
        store.tokens.push(row);
        const { token_hash, ...publicRow } = row;
        return publicRow;
    },
    revokeApiToken: async (id) => {
        const row = store.tokens.find((t) => t.id === Number(id));
        if (row) row.revoked_at = new Date();
        return row;
    },
    touchApiToken: async (id) => {
        const row = store.tokens.find((t) => t.id === Number(id));
        if (row) row.last_used_at = new Date();
    },
    deleteApiToken: async (id) => {
        const index = store.tokens.findIndex((t) => t.id === Number(id));
        return index === -1 ? undefined : store.tokens.splice(index, 1)[0];
    },
};

const modelPath = require.resolve('../database/model');
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: fakeModel };

const { createApp } = require('../app');
const { signAdminToken, signUserToken } = require('../config/auth');
const { looksLikeApiToken, hashApiToken, tokenStatus } = require('../utils/api-token');
const { API_TOKEN } = require('../config/constants');

/* ---------- fixtures ---------- */

const adminToken = signAdminToken(store.users[1]);
const nonAdminToken = signAdminToken(store.users[2]);
const clientToken = signUserToken(store.users[2]);

let server;
let base;

async function request(method, path, { token, headers = {}, body } = {}) {
    const requestHeaders = { ...headers };
    if (token) requestHeaders.Authorization = `Bearer ${token}`;
    if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
    const response = await fetch(`${base}${path}`, {
        method,
        headers: requestHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const isJson = (response.headers.get('content-type') || '').includes('application/json');
    return { status: response.status, body: isJson ? await response.json() : await response.text() };
}

const generate = (body, token = adminToken) => request('POST', '/api/api-tokens', { token, body });

test.before(async () => {
    server = http.createServer(createApp());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    await new Promise((resolve) => server.close(resolve));
});

/* ---------- pure helpers ---------- */

test('looksLikeApiToken only accepts the generated format', () => {
    const valid = `${API_TOKEN.PREFIX}${'a'.repeat(API_TOKEN.RANDOM_BYTES * 2)}`;
    assert.equal(looksLikeApiToken(valid), true);
    assert.equal(looksLikeApiToken(valid.slice(0, -1)), false);
    assert.equal(looksLikeApiToken(`${valid}0`), false);
    assert.equal(looksLikeApiToken(valid.replace(/a$/, 'z')), false);
    assert.equal(looksLikeApiToken(adminToken), false);
    assert.equal(looksLikeApiToken(''), false);
    assert.equal(looksLikeApiToken(null), false);
});

test('tokenStatus reports revoked before expired', () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 1000);
    assert.equal(tokenStatus({ revoked_at: null, expires_at: null }), 'active');
    assert.equal(tokenStatus({ revoked_at: null, expires_at: future }), 'active');
    assert.equal(tokenStatus({ revoked_at: null, expires_at: past }), 'expired');
    assert.equal(tokenStatus({ revoked_at: past, expires_at: past }), 'revoked');
});

/* ---------- token management (admin) ---------- */

test('token management requires an admin session', async () => {
    assert.equal((await request('GET', '/api/api-tokens')).status, 401);
    assert.equal((await request('GET', '/api/api-tokens', { token: clientToken })).status, 401);
    assert.equal((await request('GET', '/api/api-tokens', { token: nonAdminToken })).status, 401);
    assert.equal((await generate({ name: 'x' }, null)).status, 401);
});

test('generating a token validates the input', async () => {
    assert.equal((await generate({})).status, 400);
    assert.equal((await generate({ name: '   ' })).status, 400);
    assert.equal((await generate({ name: 'n'.repeat(API_TOKEN.NAME_MAX_LENGTH + 1) })).status, 400);
    assert.equal((await generate({ name: 'ok', expires_in_days: -1 })).status, 400);
    assert.equal((await generate({ name: 'ok', expires_in_days: 1.5 })).status, 400);
    assert.equal((await generate({ name: 'ok', expires_in_days: 'soon' })).status, 400);
    assert.equal((await generate({ name: 'ok', expires_in_days: API_TOKEN.MAX_EXPIRES_IN_DAYS + 1 })).status, 400);
});

test('a generated token is returned once and stored only as a hash', async () => {
    const { status, body } = await generate({ name: 'Scraper' });
    assert.equal(status, 201);
    assert.equal(looksLikeApiToken(body.token), true);
    assert.equal(body.api_token.name, 'Scraper');
    assert.equal(body.api_token.status, 'active');
    assert.equal(body.api_token.expires_at, null);
    assert.equal(body.api_token.created_by_email, 'admin@test.local');
    assert.equal(body.api_token.token_prefix, body.token.slice(0, API_TOKEN.DISPLAY_PREFIX_LENGTH));
    assert.equal('token_hash' in body.api_token, false);

    const stored = store.tokens.find((t) => t.id === body.api_token.id);
    assert.equal(stored.token_hash, hashApiToken(body.token));
    assert.equal(stored.token_hash.includes(body.token), false);

    const list = await request('GET', '/api/api-tokens', { token: adminToken });
    assert.equal(list.status, 200);
    const listed = list.body.tokens.find((t) => t.id === body.api_token.id);
    assert.ok(listed);
    assert.equal(listed.token, undefined);
    assert.equal(listed.token_hash, undefined);
    assert.equal(listed.created_by_name, 'Admin');
});

test('expires_in_days sets the expiry', async () => {
    const before = Date.now();
    const { status, body } = await generate({ name: 'Short lived', expires_in_days: 30 });
    assert.equal(status, 201);
    const expiresAt = new Date(body.api_token.expires_at).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    assert.ok(expiresAt >= before + thirtyDays - 1000);
    assert.ok(expiresAt <= Date.now() + thirtyDays + 1000);
});

/* ---------- job list guard ---------- */

test('the job list rejects requests without a credential', async () => {
    const list = await request('GET', '/api/jobs');
    assert.equal(list.status, 401);
    assert.match(list.body.error, /API token required/);

    const today = await request('GET', '/api/jobs/today');
    assert.equal(today.status, 401);
});

test('the job list rejects unknown, client and non-admin tokens', async () => {
    const unknown = `${API_TOKEN.PREFIX}${'f'.repeat(API_TOKEN.RANDOM_BYTES * 2)}`;
    assert.equal((await request('GET', '/api/jobs', { token: unknown })).status, 401);
    assert.equal((await request('GET', '/api/jobs', { token: clientToken })).status, 401);
    assert.equal((await request('GET', '/api/jobs', { token: nonAdminToken })).status, 401);
    assert.equal((await request('GET', '/api/jobs', { token: 'garbage' })).status, 401);
    assert.equal((await request('GET', '/api/jobs', { headers: { 'X-API-Key': unknown } })).status, 401);
});

test('a generated token grants access via Bearer or X-API-Key and records usage', async () => {
    const { body } = await generate({ name: 'Feed reader' });
    const token = body.token;

    const bearer = await request('GET', '/api/jobs?page=1&limit=5', { token });
    assert.equal(bearer.status, 200);
    assert.equal(bearer.body.jobs.length, 1);

    const apiKey = await request('GET', '/api/jobs/today', { headers: { 'X-API-Key': token } });
    assert.equal(apiKey.status, 200);
    assert.equal(apiKey.body.count, 1);

    // last_used_at is written best effort right after the request is let through
    await new Promise((resolve) => setTimeout(resolve, 20));
    const stored = store.tokens.find((t) => t.id === body.api_token.id);
    assert.ok(stored.last_used_at instanceof Date);

    const list = await request('GET', '/api/api-tokens', { token: adminToken });
    assert.ok(list.body.tokens.find((t) => t.id === body.api_token.id).last_used_at);
});

test('the dashboard admin session can still read the job list', async () => {
    assert.equal((await request('GET', '/api/jobs', { token: adminToken })).status, 200);
    assert.equal((await request('GET', '/api/jobs/today', { token: adminToken })).status, 200);
});

test('other job routes stay unauthenticated', async () => {
    fakeModel.getJobById = async () => ({ id: 7, title: 'Dev' });
    const single = await request('GET', '/api/jobs/7');
    assert.equal(single.status, 200);
});

test('a revoked token is rejected and cannot be revoked twice', async () => {
    const { body } = await generate({ name: 'To revoke' });
    const id = body.api_token.id;

    assert.equal((await request('GET', '/api/jobs', { token: body.token })).status, 200);

    assert.equal((await request('POST', `/api/api-tokens/${id}/revoke`)).status, 401);
    const revoke = await request('POST', `/api/api-tokens/${id}/revoke`, { token: adminToken });
    assert.equal(revoke.status, 200);
    assert.equal(revoke.body.token.status, 'revoked');
    assert.ok(revoke.body.token.revoked_at);

    const rejected = await request('GET', '/api/jobs', { token: body.token });
    assert.equal(rejected.status, 401);
    assert.match(rejected.body.error, /revoked/);

    assert.equal((await request('POST', `/api/api-tokens/${id}/revoke`, { token: adminToken })).status, 400);
    assert.equal((await request('POST', '/api/api-tokens/9999/revoke', { token: adminToken })).status, 404);
});

test('an expired token is rejected', async () => {
    const { body } = await generate({ name: 'Expiring', expires_in_days: 1 });
    const stored = store.tokens.find((t) => t.id === body.api_token.id);
    stored.expires_at = new Date(Date.now() - 1000);

    const rejected = await request('GET', '/api/jobs', { token: body.token });
    assert.equal(rejected.status, 401);
    assert.match(rejected.body.error, /expired/);

    const list = await request('GET', '/api/api-tokens', { token: adminToken });
    assert.equal(list.body.tokens.find((t) => t.id === body.api_token.id).status, 'expired');
});

test('deleting a token removes it and revokes access', async () => {
    const { body } = await generate({ name: 'To delete' });
    const id = body.api_token.id;

    assert.equal((await request('DELETE', `/api/api-tokens/${id}`)).status, 401);
    assert.equal((await request('DELETE', `/api/api-tokens/${id}`, { token: adminToken })).status, 200);
    assert.equal((await request('GET', `/api/api-tokens/${id}`, { token: adminToken })).status, 404);
    assert.equal((await request('DELETE', `/api/api-tokens/${id}`, { token: adminToken })).status, 404);
    assert.equal((await request('GET', '/api/jobs', { token: body.token })).status, 401);
});
