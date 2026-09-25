'use strict';

/**
 * Job URL normalisation.
 *
 * Job boards wrap postings in redirect/tracking URLs; two links to the same job
 * rarely match byte-for-byte. `normalizeUrl` produces a canonical form that is
 * stored in `jobs.normalized_url` / `block_list.url` for duplicate and block
 * checks. The rules mirror the original bid_check.js tooling and must stay
 * stable, otherwise previously stored values stop matching.
 */

const REDIRECT_DOMAINS = {
    'www.indeed.com': 'jk',
    'www.wiraa.com': 'source',
};

// Hosts whose query string carries the job identity and must be kept
const QUERY_SENSITIVE_HOST_FRAGMENTS = ['indeed', 'builtin', 'wellfound', 'recruiting.ultipro', 'wiraa'];

function sortQueryParams(search) {
    const params = new URLSearchParams(search);
    const sorted = new URLSearchParams();
    for (const key of Array.from(params.keys()).sort()) {
        sorted.append(key, params.get(key));
    }
    return sorted;
}

function normalizeQuery(url) {
    const urlObj = new URL(url);
    urlObj.search = sortQueryParams(urlObj.search).toString();
    return urlObj.toString();
}

function extractTargetUrl(url) {
    const urlObj = new URL(url);
    const targetParam = REDIRECT_DOMAINS[urlObj.hostname];

    if (targetParam) {
        const params = new URLSearchParams(urlObj.search);

        // Indeed only exposes the job key, rebuild the canonical view URL
        if (targetParam === 'jk' && params.has('jk')) {
            return `https://${urlObj.hostname}/viewjob?jk=${params.get('jk')}`;
        }

        if (params.has(targetParam)) {
            return decodeURIComponent(params.get(targetParam));
        }
    }

    return normalizeQuery(url);
}

function normalizeFinalUrl(url) {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    const pathname = urlObj.pathname.replace(/\/$/, '');
    return `${urlObj.protocol}//${hostname}${pathname}?${sortQueryParams(urlObj.search).toString()}`;
}

function clearLink(link) {
    link = String(link);

    // Drop tracking query strings unless the host needs them to identify the job
    if (link.includes('?') && !QUERY_SENSITIVE_HOST_FRAGMENTS.some((fragment) => link.includes(fragment))) {
        link = link.split('?')[0];
    }

    if (link.endsWith('/')) {
        link = link.slice(0, -1);
    }
    if (link.endsWith('/apply')) {
        link = link.slice(0, -'/apply'.length);
    }
    if (link.endsWith('/application')) {
        link = link.slice(0, -'/application'.length);
    }

    if (link.includes('www.indeed.com')) {
        link = extractTargetUrl(link);
    }

    return link;
}

/** Canonical form of a job URL; returns the input untouched when it is not a valid URL. */
function normalizeUrl(url) {
    try {
        return normalizeFinalUrl(clearLink(url));
    } catch (error) {
        return url;
    }
}

module.exports = {
    normalizeUrl,
    clearLink,
    extractTargetUrl,
    normalizeQuery,
    normalizeFinalUrl,
};
