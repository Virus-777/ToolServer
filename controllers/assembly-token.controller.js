'use strict';

const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { logHistory } = require('../utils/history');
const { HISTORY_ACTIONS, HISTORY_ENTITIES } = require('../config/constants');

exports.getAllAssemblyTokens = async (req, res) => {
    try {
        const tokens = await model.getAllAssemblyTokens();
        res.status(200).json({ tokens });
    } catch (error) {
        console.error('Get all assembly tokens error:', error);
        handleError(res, 500, 'Error fetching assembly tokens');
    }
};

exports.getAssemblyToken = async (req, res) => {
    const { id } = req.params;

    try {
        const token = await model.getAssemblyTokenById(id);
        if (!token) {
            return handleError(res, 404, 'Assembly token not found');
        }

        res.status(200).json({ token });
    } catch (error) {
        console.error('Get assembly token error:', error);
        handleError(res, 500, 'Error fetching assembly token');
    }
};

exports.createAssemblyToken = async (req, res) => {
    const { user_id: userId, api_key: apiKey } = req.body;

    if (!userId) {
        return handleError(res, 400, 'User ID is required');
    }
    if (!apiKey) {
        return handleError(res, 400, 'API key is required');
    }

    try {
        const user = await model.getUserById(userId);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        if (await model.getAssemblyToken(userId)) {
            return handleError(res, 400, 'Assembly token already exists for this user');
        }

        const newToken = await model.createAssemblyToken(userId, apiKey);

        await logHistory(req, {
            action: HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.ASSEMBLY_TOKEN,
            entityId: newToken.id,
            description: `Assembly token created for user: ${user.email}`,
            metadata: { user_id: userId, user_email: user.email },
        });

        res.status(201).json({
            message: 'Assembly token created successfully',
            token: newToken,
        });
    } catch (error) {
        console.error('Create assembly token error:', error);
        handleError(res, 500, 'Error creating assembly token');
    }
};

exports.updateAssemblyToken = async (req, res) => {
    const { id } = req.params;
    const { user_id: userId, api_key: apiKey } = req.body;

    if (!userId) {
        return handleError(res, 400, 'User ID is required');
    }
    if (!apiKey) {
        return handleError(res, 400, 'API key is required');
    }

    try {
        const existingToken = await model.getAssemblyTokenById(id);
        if (!existingToken) {
            return handleError(res, 404, 'Assembly token not found');
        }

        const user = await model.getUserById(userId);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // When the token is moved to another user, that user must not already have one
        if (Number(existingToken.user_id) !== Number(userId)) {
            const userToken = await model.getAssemblyToken(userId);
            if (userToken && userToken.id !== Number(id)) {
                return handleError(res, 400, 'Assembly token already exists for this user');
            }
        }

        const updatedToken = await model.updateAssemblyToken(id, userId, apiKey);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.ASSEMBLY_TOKEN,
            entityId: id,
            description: `Assembly token updated for user: ${user.email}`,
            metadata: { user_id: userId, user_email: user.email },
        });

        res.status(200).json({
            message: 'Assembly token updated successfully',
            token: updatedToken,
        });
    } catch (error) {
        console.error('Update assembly token error:', error);
        handleError(res, 500, 'Error updating assembly token');
    }
};

exports.deleteAssemblyToken = async (req, res) => {
    const { id } = req.params;

    try {
        const token = await model.getAssemblyTokenById(id);
        if (!token) {
            return handleError(res, 404, 'Assembly token not found');
        }

        await model.deleteAssemblyToken(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.ASSEMBLY_TOKEN,
            entityId: id,
            description: `Assembly token deleted for user: ${token.user_email || 'unknown'}`,
            metadata: { user_id: token.user_id, user_email: token.user_email },
        });

        res.status(200).json({ message: 'Assembly token deleted successfully' });
    } catch (error) {
        console.error('Delete assembly token error:', error);
        handleError(res, 500, 'Error deleting assembly token');
    }
};
