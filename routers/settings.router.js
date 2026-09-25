const express = require('express');
const { getSettings, getSetting, getSettingByKey, createSetting, updateSetting, deleteSetting } = require('../controllers/settings.controller');
const { authenticate, requireAllowedEmail } = require('../utils/auth.middleware');
const router = express.Router();

// All settings routes require authentication and an email on the allowed list
router.use(authenticate, requireAllowedEmail);

router.route('/')
    .get(getSettings)
    .post(createSetting);

router.route('/key/:key')
    .get(getSettingByKey);

router.route('/:id')
    .get(getSetting)
    .put(updateSetting)
    .delete(deleteSetting);

module.exports = router;
