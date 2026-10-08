'use strict';

/**
 * Release version helpers for the client application updates.
 *
 * Versions are dotted numeric strings with two to four segments
 * ("1.2", "1.2.3", "1.2.3.4") so they can be compared numerically both here
 * and in SQL (`string_to_array(version, '.')::int[]`).
 */

const VERSION_PATTERN = /^\d{1,6}(\.\d{1,6}){1,3}$/;

/** Trim whitespace and an optional leading "v" ("v1.2.0" -> "1.2.0"). */
exports.normalizeVersion = (value) => {
    if (value === undefined || value === null) {
        return '';
    }
    return String(value).trim().replace(/^v/i, '');
};

exports.isValidVersion = (value) => typeof value === 'string' && VERSION_PATTERN.test(value);

/** Numeric segment comparison; missing segments count as 0. Returns -1, 0 or 1. */
exports.compareVersions = (a, b) => {
    const left = a.split('.').map(Number);
    const right = b.split('.').map(Number);
    const length = Math.max(left.length, right.length);

    for (let i = 0; i < length; i += 1) {
        const diff = (left[i] || 0) - (right[i] || 0);
        if (diff !== 0) {
            return diff > 0 ? 1 : -1;
        }
    }
    return 0;
};
