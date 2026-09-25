'use strict';

/** Send a JSON error response: { error: "..." } */
exports.handleError = (res, status, error) => {
    res.status(status).json({ error });
};

/** Parse a positive integer, returning `fallback` for anything else. */
exports.parsePositiveInt = (value, fallback) => {
    const parsed = parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * Normalise `page` / `limit` query parameters.
 * Invalid values fall back to defaults and `limit` is capped at `maxLimit`.
 */
exports.parsePagination = (query, { defaultLimit, maxLimit }) => {
    const page = exports.parsePositiveInt(query.page, 1);
    const limit = Math.min(exports.parsePositiveInt(query.limit, defaultLimit), maxLimit);
    return { page, limit };
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
exports.isValidEmail = (value) => typeof value === 'string' && EMAIL_PATTERN.test(value);

exports.isValidUrl = (value) => {
    try {
        new URL(value);
        return true;
    } catch (error) {
        return false;
    }
};

/** Strip the password hash before sending a user row to a client. */
exports.sanitizeUser = (user) => {
    if (!user) {
        return user;
    }
    const { password, ...safeUser } = user;
    return safeUser;
};

/** Return `null` for empty / missing values so optional columns are stored as NULL. */
exports.emptyToNull = (value) => {
    if (value === undefined || value === null) {
        return null;
    }
    const text = String(value);
    return text.trim() === '' ? null : text;
};
