'use strict';

/**
 * Data-access layer facade.
 *
 * Each table has its own module under ./models; this file re-exports all of
 * them so callers keep using `require('../database/model')`.
 */
module.exports = {
    ...require('./models/users'),
    ...require('./models/settings'),
    ...require('./models/configs'),
    ...require('./models/jobs'),
    ...require('./models/block-list'),
    ...require('./models/history'),
    ...require('./models/allowed-emails'),
    ...require('./models/assembly-tokens'),
};
