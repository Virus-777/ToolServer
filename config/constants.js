'use strict';

/**
 * Shared constants.
 *
 * Every magic number / string that is used by more than one module lives here so
 * that controllers, models and middleware stay in sync.
 */

// Job industry categories (jobs.industry column)
const INDUSTRY = Object.freeze({ SOFTWARE: 0, CIVIL: 1 });
const INDUSTRY_VALUES = Object.freeze(Object.values(INDUSTRY));

// Settings that are managed through dedicated endpoints/pages
const SETTING_KEYS = Object.freeze({
    SELECTED_GPT_MODEL: 'selected_gpt_model',
    OPENAI_API_KEY: 'openai_api_key',
});
const PROTECTED_SETTING_KEYS = Object.freeze([
    SETTING_KEYS.OPENAI_API_KEY,
    SETTING_KEYS.SELECTED_GPT_MODEL,
]);

const DEFAULT_GPT_MODEL = 'gpt-5-mini';

// Audit log vocabulary (history.action_type / history.entity_type)
const HISTORY_ACTIONS = Object.freeze({
    SIGN_UP: 'sign_up',
    LOGIN: 'login',
    CREATE: 'create',
    UPDATE: 'update',
    DELETE: 'delete',
});
const HISTORY_ENTITIES = Object.freeze({
    USER: 'user',
    JOB: 'job',
    BLOCK_LIST: 'block_list',
    SETTING: 'setting',
    CONFIG: 'config',
    ALLOWED_EMAIL: 'allowed_email',
    ASSEMBLY_TOKEN: 'assembly_token',
});

const USER_ROLES = Object.freeze({ ADMIN: 'admin', USER: 'user' });

// users.blocked column: 1 = active, 0 = blocked
const USER_STATUS = Object.freeze({ BLOCKED: 0, ACTIVE: 1 });

const PAGINATION = Object.freeze({
    DEFAULT_PAGE: 1,
    JOBS_DEFAULT_LIMIT: 20,
    HISTORY_DEFAULT_LIMIT: 50,
    // The dashboard export fetches up to 10 000 rows in one request
    MAX_LIMIT: 10000,
});

// Time zone that defines "today" for the jobs feed consumed by the client app
const JOBS_TIME_ZONE = 'America/Los_Angeles';

module.exports = {
    INDUSTRY,
    INDUSTRY_VALUES,
    SETTING_KEYS,
    PROTECTED_SETTING_KEYS,
    DEFAULT_GPT_MODEL,
    HISTORY_ACTIONS,
    HISTORY_ENTITIES,
    USER_ROLES,
    USER_STATUS,
    PAGINATION,
    JOBS_TIME_ZONE,
};
