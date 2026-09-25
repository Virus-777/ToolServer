'use strict';

const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

/**
 * Per-user configuration (/api/config).
 *
 * The four writable fields share identical save/get logic, so the handlers are
 * generated from this table instead of being copy-pasted.
 */
const CONFIG_FIELDS = {
    prompt: { column: 'prompt', label: 'Prompt', noun: 'prompt', save: model.savePrompt, logValue: false },
    resume: { column: 'resume', label: 'Resume', noun: 'resume', save: model.saveResume, logValue: false },
    template: { column: 'template_path', label: 'Template path', noun: 'template path', save: model.saveTemplate, logValue: true },
    folder: { column: 'folder_path', label: 'Folder path', noun: 'folder path', save: model.saveFolder, logValue: true },
};

/** POST handler: body { user_email, <column> } */
function makeSaveHandler({ column, label, noun, save, logValue }) {
    return async (req, res) => {
        const { user_email: userEmail } = req.body;
        const value = req.body[column];

        try {
            if (!userEmail || !value) {
                return handleError(res, 400, `User email and ${noun} are required`);
            }

            const existingConfig = await model.getConfigByEmail(userEmail);
            const config = await save(userEmail, value);

            await logHistory(req, {
                action: existingConfig ? HISTORY_ACTIONS.UPDATE : HISTORY_ACTIONS.CREATE,
                entity: HISTORY_ENTITIES.CONFIG,
                entityId: config.id,
                description: `${label} ${existingConfig ? 'updated' : 'saved'} for user: ${userEmail}`,
                metadata: { user_email: userEmail, field: column, ...(logValue ? { [column]: value } : {}) },
                actorEmail: userEmail,
            });

            res.status(200).json({
                message: `${label} saved successfully`,
                config,
            });
        } catch (error) {
            console.error(`Save ${noun} error:`, error);
            handleError(res, 500, `Error saving ${noun}`);
        }
    };
}

/** GET handler: /:userEmail -> { <column>: value } */
function makeGetHandler({ column, noun }) {
    return async (req, res) => {
        const { userEmail } = req.params;

        try {
            const config = await model.getConfigByEmail(userEmail);

            if (!config) {
                return res.status(200).json({
                    [column]: null,
                    message: 'No configuration found for this user',
                });
            }

            res.status(200).json({ [column]: config[column] });
        } catch (error) {
            console.error(`Get ${noun} error:`, error);
            handleError(res, 500, `Error fetching ${noun}`);
        }
    };
}

exports.savePrompt = makeSaveHandler(CONFIG_FIELDS.prompt);
exports.getPrompt = makeGetHandler(CONFIG_FIELDS.prompt);
exports.saveResume = makeSaveHandler(CONFIG_FIELDS.resume);
exports.getResume = makeGetHandler(CONFIG_FIELDS.resume);
exports.saveTemplate = makeSaveHandler(CONFIG_FIELDS.template);
exports.getTemplate = makeGetHandler(CONFIG_FIELDS.template);
exports.saveFolder = makeSaveHandler(CONFIG_FIELDS.folder);
exports.getFolder = makeGetHandler(CONFIG_FIELDS.folder);

exports.getAllConfigs = async (req, res) => {
    try {
        const configs = await model.getAllConfigs();
        res.status(200).json({ configs });
    } catch (error) {
        console.error('Get all configs error:', error);
        handleError(res, 500, 'Error fetching all configurations');
    }
};

exports.getAllConfig = async (req, res) => {
    const { userEmail } = req.params;

    try {
        const config = await model.getConfigByEmail(userEmail);

        if (!config) {
            return res.status(200).json({
                config: { prompt: null, resume: null, template_path: null, folder_path: null },
                message: 'No configuration found for this user',
            });
        }

        res.status(200).json({
            config: {
                prompt: config.prompt,
                resume: config.resume,
                template_path: config.template_path,
                folder_path: config.folder_path,
                created_at: config.created_at,
                updated_at: config.updated_at,
            },
        });
    } catch (error) {
        console.error('Get all config error:', error);
        handleError(res, 500, 'Error fetching configuration');
    }
};

exports.deleteConfig = async (req, res) => {
    const { userEmail } = req.params;

    try {
        const config = await model.getConfigByEmail(userEmail);
        if (!config) {
            return handleError(res, 404, 'Configuration not found for this user');
        }

        await model.deleteConfig(userEmail);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.CONFIG,
            entityId: config.id,
            description: `User configuration deleted: ${userEmail}`,
            metadata: { user_email: userEmail },
            actorEmail: userEmail,
        });

        res.status(200).json({ message: 'Configuration deleted successfully' });
    } catch (error) {
        console.error('Delete config error:', error);
        handleError(res, 500, 'Error deleting configuration');
    }
};
