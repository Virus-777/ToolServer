'use strict';

const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { HISTORY_ACTIONS, HISTORY_ENTITIES, PROTECTED_SETTING_KEYS } = require('../config/constants');

// Metadata keeps only a preview of the value to avoid bloating the audit log
const previewValue = (value) => String(value).substring(0, 100);

exports.getSettings = async (req, res) => {
    try {
        const settings = await model.getSettings();

        // Sensitive settings are managed on dedicated pages
        const visibleSettings = settings.filter((setting) => !PROTECTED_SETTING_KEYS.includes(setting.key));

        res.status(200).json({ settings: visibleSettings });
    } catch (error) {
        console.error('Get settings error:', error);
        handleError(res, 500, 'Error fetching settings');
    }
};

exports.getSetting = async (req, res) => {
    const { id } = req.params;

    try {
        const setting = await model.getSettingById(id);
        if (!setting) {
            return handleError(res, 404, 'Setting not found');
        }

        res.status(200).json({ setting });
    } catch (error) {
        console.error('Get setting error:', error);
        handleError(res, 500, 'Error fetching setting');
    }
};

exports.getSettingByKey = async (req, res) => {
    const { key } = req.params;

    try {
        const setting = await model.getSettingByKey(key);
        if (!setting) {
            return handleError(res, 404, 'Setting not found');
        }

        res.status(200).json({ setting });
    } catch (error) {
        console.error('Get setting by key error:', error);
        handleError(res, 500, 'Error fetching setting');
    }
};

exports.createSetting = async (req, res) => {
    const { key, value } = req.body;

    try {
        if (!key || !value) {
            return handleError(res, 400, 'Key and value are required');
        }

        if (await model.getSettingByKey(key)) {
            return handleError(res, 400, 'Setting with this key already exists');
        }

        const newSetting = await model.createSetting(key, value);

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.SETTING,
            entityId: newSetting.id,
            description: `Setting created: ${key}`,
            metadata: { key, value: previewValue(value) },
        });

        res.status(201).json({
            message: 'Setting created successfully',
            setting: newSetting,
        });
    } catch (error) {
        console.error('Create setting error:', error);
        handleError(res, 500, 'Error creating setting');
    }
};

exports.updateSetting = async (req, res) => {
    const { id } = req.params;
    const { key, value } = req.body;

    try {
        const existingSetting = await model.getSettingById(id);
        if (!existingSetting) {
            return handleError(res, 404, 'Setting not found');
        }

        if (PROTECTED_SETTING_KEYS.includes(existingSetting.key)) {
            return handleError(res, 403, 'This setting cannot be edited here. Please use the dedicated page.');
        }

        if (!key || !value) {
            return handleError(res, 400, 'Key and value are required');
        }

        if (key !== existingSetting.key && (await model.getSettingByKey(key))) {
            return handleError(res, 400, 'Key already in use');
        }

        const updatedSetting = await model.updateSetting(id, key, value);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.SETTING,
            entityId: id,
            description: `Setting updated: ${key}`,
            metadata: { key, value: previewValue(value) },
        });

        res.status(200).json({
            message: 'Setting updated successfully',
            setting: updatedSetting,
        });
    } catch (error) {
        console.error('Update setting error:', error);
        handleError(res, 500, 'Error updating setting');
    }
};

exports.deleteSetting = async (req, res) => {
    const { id } = req.params;

    try {
        const setting = await model.getSettingById(id);
        if (!setting) {
            return handleError(res, 404, 'Setting not found');
        }

        if (PROTECTED_SETTING_KEYS.includes(setting.key)) {
            return handleError(res, 403, 'This setting cannot be deleted here. Please use the dedicated page.');
        }

        await model.deleteSetting(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.SETTING,
            entityId: id,
            description: `Setting deleted: ${setting.key}`,
            metadata: { key: setting.key },
        });

        res.status(200).json({ message: 'Setting deleted successfully' });
    } catch (error) {
        console.error('Delete setting error:', error);
        handleError(res, 500, 'Error deleting setting');
    }
};
