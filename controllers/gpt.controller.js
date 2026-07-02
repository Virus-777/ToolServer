const model = require('../database/model');
const { handleError } = require('../utils/utils');
const OpenAI = require('openai');
const openai = new OpenAI({
    baseURL: 'http://127.0.0.1:11434/v1',
    apiKey: 'ollama',
});

// Available GPT models
const GPT_MODELS = [
    // GPT-5 series
    { id: 'gpt-5.5', name: 'GPT-5.5', description: 'Input $5.00 | Cached $0.50 | Output $30.00' },
    { id: 'gpt-5.4', name: 'GPT-5.4', description: 'Input $2.50 | Cached $0.25 | Output $15.00' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini', description: 'Input $0.75 | Cached $0.075 | Output $4.50' },
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Input $1.75 | Cached $0.175 | Output $14.00' },
    { id: 'gpt-5.1', name: 'GPT-5.1', description: 'Input $1.25 | Cached $0.125 | Output $10.00' },
    { id: 'gpt-5', name: 'GPT-5', description: 'Input $1.25 | Cached $0.125 | Output $10.00' },
    { id: 'gpt-5-mini', name: 'GPT-5 Mini', description: 'Input $0.25 | Cached $0.025 | Output $2.00' },
    { id: 'gpt-5-nano', name: 'GPT-5 Nano', description: 'Input $0.05 | Cached $0.005 | Output $0.40' },
    // GPT-5 Chat latest
    { id: 'gpt-5.2-chat-latest', name: 'GPT-5.2 Chat Latest', description: 'Input $1.75 | Cached $0.175 | Output $14.00' },
    { id: 'gpt-5.1-chat-latest', name: 'GPT-5.1 Chat Latest', description: 'Input $1.25 | Cached $0.125 | Output $10.00' },
    { id: 'gpt-5-chat-latest', name: 'GPT-5 Chat Latest', description: 'Input $1.25 | Cached $0.125 | Output $10.00' },
    // Ollama models
    { id: 'gpt-oss:120b-cloud', name: 'GPT-OSS 120B Cloud', description: '120B parameter model for cloud use on ollama' },
    { id: 'kimi-k2.5:cloud', name: 'Kimi K2.5 Cloud', description: 'Kimi K2.5 model for cloud use on ollama' },
];

const SETTING_KEY = 'selected_gpt_model';
const API_KEY_SETTING = 'openai_api_key';

// Get available GPT models
exports.getAvailableModels = async (req, res) => {
    try {
        res.status(200).json({
            models: GPT_MODELS
        });
    } catch (error) {
        console.error('Get models error:', error);
        handleError(res, 500, 'Error fetching GPT models');
    }
}

// Get currently selected model
exports.getSelectedModel = async (req, res) => {
    try {
        const setting = await model.getSettingByKey(SETTING_KEY);

        if (!setting) {
            // Return default model if not set
            return res.status(200).json({
                selectedModel: 'gpt-5-mini',
                isDefault: true
            });
        }

        res.status(200).json({
            selectedModel: setting.value,
            isDefault: false
        });
    } catch (error) {
        console.error('Get selected model error:', error);
        handleError(res, 500, 'Error fetching selected model');
    }
}

// Set selected model
exports.setSelectedModel = async (req, res) => {
    const { modelId } = req.body;

    try {
        if (!modelId) {
            return handleError(res, 400, 'Model ID is required');
        }

        // Validate model ID
        const validModel = GPT_MODELS.find(m => m.id === modelId);
        if (!validModel) {
            return handleError(res, 400, 'Invalid model ID');
        }

        // Check if setting exists
        const existingSetting = await model.getSettingByKey(SETTING_KEY);

        if (existingSetting) {
            // Update existing setting
            await model.updateSetting(existingSetting.id, SETTING_KEY, modelId);
        } else {
            // Create new setting
            await model.createSetting(SETTING_KEY, modelId);
        }

        res.status(200).json({
            message: 'GPT model updated successfully',
            selectedModel: modelId,
            modelName: validModel.name
        });
    } catch (error) {
        console.error('Set selected model error:', error);
        handleError(res, 500, 'Error updating selected model');
    }
}

// Get OpenAI API key
exports.getApiKey = async (req, res) => {
    try {
        const setting = await model.getSettingByKey(API_KEY_SETTING);

        if (!setting) {
            return res.status(200).json({
                apiKey: null,
                isSet: false
            });
        }

        // Mask the API key for security (show only last 4 characters)
        const maskedKey = setting.value.length > 4
            ? '•'.repeat(setting.value.length - 4) + setting.value.slice(-4)
            : '••••';

        res.status(200).json({
            apiKey: maskedKey,
            isSet: true
        });
    } catch (error) {
        console.error('Get API key error:', error);
        handleError(res, 500, 'Error fetching API key');
    }
}

// Save OpenAI API key
exports.saveApiKey = async (req, res) => {
    const { apiKey } = req.body;

    try {
        if (!apiKey) {
            return handleError(res, 400, 'API key is required');
        }

        // Validate API key format (basic check)
        if (!apiKey.startsWith('sk-') || apiKey.length < 20) {
            return handleError(res, 400, 'Invalid API key format');
        }

        // Check if setting exists
        const existingSetting = await model.getSettingByKey(API_KEY_SETTING);

        if (existingSetting) {
            // Update existing setting
            await model.updateSetting(existingSetting.id, API_KEY_SETTING, apiKey);
        } else {
            // Create new setting
            await model.createSetting(API_KEY_SETTING, apiKey);
        }

        res.status(200).json({
            message: 'OpenAI API key saved successfully',
            isSet: true
        });
    } catch (error) {
        console.error('Save API key error:', error);
        handleError(res, 500, 'Error saving API key');
    }
}

exports.getResponses = async (req, res) => {
    try {
        const response = await openai.responses.create(req.body);

        res.status(200).send(response);
    } catch (error) {
        console.error('Get responses error:', error);
        handleError(res, 500, 'Error fetching responses');
    }
}