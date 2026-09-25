'use strict';

const model = require('../database/model');
const { getClientIP } = require('./ip.utils');

/**
 * Write an audit-log entry for the current request.
 *
 * The actor defaults to the authenticated user (`req.user`). Public endpoints
 * (login, registration, client config updates) can pass an explicit `actor`
 * or just an `actorEmail` so the entry is still attributable. Logging never
 * throws: a failure to write history must not fail an operation that already
 * succeeded.
 *
 * @param {import('express').Request} req
 * @param {object} entry
 * @param {string} entry.action        One of HISTORY_ACTIONS
 * @param {string} entry.entity        One of HISTORY_ENTITIES
 * @param {number|string|null} [entry.entityId]
 * @param {string} entry.description
 * @param {object|null} [entry.metadata]
 * @param {{id?: number, email?: string}} [entry.actor]  Overrides req.user
 * @param {string|null} [entry.actorEmail]               Fallback email when there is no actor
 */
async function logHistory(req, { action, entity, entityId = null, description, metadata = null, actor, actorEmail = null }) {
    const effectiveActor = actor !== undefined ? actor : (req.user || null);
    const userId = effectiveActor && effectiveActor.id !== undefined ? effectiveActor.id : null;
    const userEmail = (effectiveActor && effectiveActor.email) || actorEmail || null;

    try {
        await model.createHistoryLog(userId, userEmail, action, entity, entityId, description, getClientIP(req), metadata);
    } catch (error) {
        console.error('Failed to write history log:', error.message);
    }
}

module.exports = { logHistory };
