'use strict';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True when `value` looks like YYYY-MM-DD. */
const isIsoDate = (value) => typeof value === 'string' && ISO_DATE_PATTERN.test(value);

/** Today's calendar date (YYYY-MM-DD) in the given IANA time zone. */
function todayInTimeZone(timeZone, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);

    const get = (type) => parts.find((part) => part.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
}

module.exports = {
    isIsoDate,
    todayInTimeZone,
};
