'use strict';

const OpenAI = require('openai');
const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { GPT_MODELS, findModel } = require('../config/gpt-models');
const { SETTING_KEYS, DEFAULT_GPT_MODEL, HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434/v1';

let responsesClient = null;

/** OpenAI-compatible client pointed at the local Ollama gateway (created lazily). */
function getResponsesClient() {
    if (!responsesClient) {
        responsesClient = new OpenAI({
            baseURL: process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL,
            apiKey: process.env.OLLAMA_API_KEY || 'ollama',
        });
    }
    return responsesClient;
}

/** Show only the last four characters of a secret. */
const maskSecret = (value) => (value.length > 4 ? '•'.repeat(value.length - 4) + value.slice(-4) : '••••');

exports.getAvailableModels = async (req, res) => {
    res.status(200).json({ models: GPT_MODELS });
};

exports.getSelectedModel = async (req, res) => {
    try {
        const setting = await model.getSettingByKey(SETTING_KEYS.SELECTED_GPT_MODEL);

        res.status(200).json({
            selectedModel: setting ? setting.value : DEFAULT_GPT_MODEL,
            isDefault: !setting,
        });
    } catch (error) {
        console.error('Get selected model error:', error);
        handleError(res, 500, 'Error fetching selected model');
    }
};

exports.setSelectedModel = async (req, res) => {
    const { modelId } = req.body;

    try {
        if (!modelId) {
            return handleError(res, 400, 'Model ID is required');
        }

        const validModel = findModel(modelId);
        if (!validModel) {
            return handleError(res, 400, 'Invalid model ID');
        }

        await model.setSettingValue(SETTING_KEYS.SELECTED_GPT_MODEL, modelId);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.SETTING,
            description: `GPT model changed to ${validModel.name}`,
            metadata: { key: SETTING_KEYS.SELECTED_GPT_MODEL, value: modelId },
        });

        res.status(200).json({
            message: 'GPT model updated successfully',
            selectedModel: modelId,
            modelName: validModel.name,
        });
    } catch (error) {
        console.error('Set selected model error:', error);
        handleError(res, 500, 'Error updating selected model');
    }
};

exports.getApiKey = async (req, res) => {
    try {
        const setting = await model.getSettingByKey(SETTING_KEYS.OPENAI_API_KEY);

        if (!setting) {
            return res.status(200).json({ apiKey: null, isSet: false });
        }

        res.status(200).json({
            apiKey: maskSecret(setting.value),
            isSet: true,
        });
    } catch (error) {
        console.error('Get API key error:', error);
        handleError(res, 500, 'Error fetching API key');
    }
};

exports.saveApiKey = async (req, res) => {
    const { apiKey } = req.body;

    try {
        if (!apiKey) {
            return handleError(res, 400, 'API key is required');
        }

        if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
            return handleError(res, 400, 'Invalid API key format');
        }

        await model.setSettingValue(SETTING_KEYS.OPENAI_API_KEY, apiKey);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.SETTING,
            description: 'OpenAI API key updated',
            metadata: { key: SETTING_KEYS.OPENAI_API_KEY, value: maskSecret(apiKey) },
        });

        res.status(200).json({
            message: 'OpenAI API key saved successfully',
            isSet: true,
        });
    } catch (error) {
        console.error('Save API key error:', error);
        handleError(res, 500, 'Error saving API key');
    }
};

/** Proxy a Responses API request to the local model gateway. */
exports.getResponses = async (req, res) => {
    try {
        const response = await getResponsesClient().responses.create(req.body);
        res.status(200).send(response);
    } catch (error) {
        console.error('Get responses error:', error);
        handleError(res, 500, 'Error fetching responses');
    }
};
