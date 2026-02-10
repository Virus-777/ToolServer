const express = require('express');
const { getAvailableModels, getSelectedModel, setSelectedModel, getApiKey, saveApiKey } = require('../controllers/gpt.controller');
const { authenticateAdmin, authenticate } = require('../utils/auth.middleware');
const router = express.Router();

// All GPT model routes require admin authentication
router.route('/models')
    .get(authenticateAdmin, getAvailableModels);

router.route('/selected')
    .get(authenticate, getSelectedModel)
    .post(authenticateAdmin, setSelectedModel);

router.route('/apikey')
    .get(authenticateAdmin, getApiKey)
    .post(authenticateAdmin, saveApiKey);

module.exports = router;
