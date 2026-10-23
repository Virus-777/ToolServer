'use strict';

const express = require('express');
const { getAllApiTokens, getApiToken, createApiToken, revokeApiToken, deleteApiToken } = require('../controllers/api-token.controller');
const { authenticateAdmin } = require('../utils/auth.middleware');

const router = express.Router();

// Managing API tokens is a dashboard (admin) feature
router.use(authenticateAdmin);

router.route('/')
    .get(getAllApiTokens)
    .post(createApiToken);

router.route('/:id')
    .get(getApiToken)
    .delete(deleteApiToken);

router.post('/:id/revoke', revokeApiToken);

module.exports = router;
