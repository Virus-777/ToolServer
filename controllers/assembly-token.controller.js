const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');

exports.getAllAssemblyTokens = async (req, res) => {
    try {
        const tokens = await model.getAllAssemblyTokens();
        res.status(200).json({
            tokens
        });
    } catch (error) {
        console.error('Get all assembly tokens error:', error);
        handleError(res, 500, 'Error fetching assembly tokens');
    }
}

exports.getAssemblyToken = async (req, res) => {
    const { id } = req.params;

    try {
        const token = await model.getAssemblyTokenById(id);

        if (!token) {
            return handleError(res, 404, 'Assembly token not found');
        }

        res.status(200).json({
            token
        });
    } catch (error) {
        console.error('Get assembly token error:', error);
        handleError(res, 500, 'Error fetching assembly token');
    }
}

exports.createAssemblyToken = async (req, res) => {
    const { user_id, api_key } = req.body;

    if (!user_id) {
        return handleError(res, 400, 'User ID is required');
    }

    if (!api_key) {
        return handleError(res, 400, 'API key is required');
    }

    try {
        // Check if user exists
        const user = await model.getUserById(user_id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // Check if token already exists for this user
        const existingToken = await model.getAssemblyToken(user_id);
        if (existingToken) {
            return handleError(res, 400, 'Assembly token already exists for this user');
        }

        const newToken = await model.createAssemblyToken(user_id, api_key);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'create',
            'assembly_token',
            newToken.id,
            `Assembly token created for user: ${user.email}`,
            clientIP,
            { user_id, user_email: user.email }
        );

        res.status(201).json({
            message: 'Assembly token created successfully',
            token: newToken
        });
    } catch (error) {
        console.error('Create assembly token error:', error);
        handleError(res, 500, 'Error creating assembly token');
    }
}

exports.updateAssemblyToken = async (req, res) => {
    const { id } = req.params;
    const { user_id, api_key } = req.body;

    if (!user_id) {
        return handleError(res, 400, 'User ID is required');
    }

    if (!api_key) {
        return handleError(res, 400, 'API key is required');
    }

    try {
        // Check if token exists
        const existingToken = await model.getAssemblyTokenById(id);
        if (!existingToken) {
            return handleError(res, 404, 'Assembly token not found');
        }

        // Check if user exists
        const user = await model.getUserById(user_id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // Check if another token exists for this user (if changing user_id)
        if (existingToken.user_id !== user_id) {
            const userToken = await model.getAssemblyToken(user_id);
            if (userToken && userToken.id !== parseInt(id)) {
                return handleError(res, 400, 'Assembly token already exists for this user');
            }
        }

        const updatedToken = await model.updateAssemblyToken(id, user_id, api_key);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'update',
            'assembly_token',
            id,
            `Assembly token updated for user: ${user.email}`,
            clientIP,
            { user_id, user_email: user.email }
        );

        res.status(200).json({
            message: 'Assembly token updated successfully',
            token: updatedToken
        });
    } catch (error) {
        console.error('Update assembly token error:', error);
        handleError(res, 500, 'Error updating assembly token');
    }
}

exports.deleteAssemblyToken = async (req, res) => {
    const { id } = req.params;

    try {
        const token = await model.getAssemblyTokenById(id);
        if (!token) {
            return handleError(res, 404, 'Assembly token not found');
        }

        await model.deleteAssemblyToken(id);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'delete',
            'assembly_token',
            id,
            `Assembly token deleted for user: ${token.user_email || 'unknown'}`,
            clientIP,
            { user_id: token.user_id, user_email: token.user_email }
        );

        res.status(200).json({
            message: 'Assembly token deleted successfully'
        });
    } catch (error) {
        console.error('Delete assembly token error:', error);
        handleError(res, 500, 'Error deleting assembly token');
    }
}

