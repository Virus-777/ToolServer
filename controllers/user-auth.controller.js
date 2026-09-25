'use strict';

const model = require('../database/model');
const { handleError, sanitizeUser } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');
const { logHistory } = require('../utils/history');
const { signUserToken, hashPassword, verifyPassword } = require('../config/auth');
const { HISTORY_ACTIONS, HISTORY_ENTITIES, USER_ROLES, USER_STATUS } = require('../config/constants');

/**
 * Client application authentication (/api/user).
 * Tokens issued here are verified by the `user-jwt` passport strategy.
 */

exports.userLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const clientIP = getClientIP(req);

        const user = await model.getUserByEmail(email);
        if (!user) {
            return handleError(res, 401, 'Invalid email');
        }
        if (user.blocked === USER_STATUS.BLOCKED) {
            return handleError(res, 403, 'Your account has been blocked');
        }

        // Client logins are pinned to the IP the account was registered from
        if (user.registration_ip && user.registration_ip !== clientIP && clientIP !== '127.0.0.1') {
            console.warn(`User login attempt from different IP. User: ${email}, Registered IP: ${user.registration_ip}, Request IP: ${clientIP}`);
            return handleError(res, 403, 'Login from this IP address is not allowed');
        }

        if (!(await verifyPassword(password, user.password))) {
            return handleError(res, 401, 'Invalid password');
        }

        const token = signUserToken(user);

        await logHistory(req, {
            action: HISTORY_ACTIONS.LOGIN,
            entity: HISTORY_ENTITIES.USER,
            entityId: user.id,
            description: `User logged in: ${user.email}`,
            actor: user,
        });

        res.status(200).json({
            message: 'User login successful',
            token,
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('User login error:', error);
        handleError(res, 500, 'Error logging in as user');
    }
};

exports.userRegister = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const clientIP = getClientIP(req);

        if (await model.getUserByEmail(email)) {
            return handleError(res, 400, 'User with this email already exists');
        }

        // The very first account becomes the administrator
        const role = (await model.countUsers()) === 0 ? USER_ROLES.ADMIN : USER_ROLES.USER;
        const newUser = await model.createUser(name, email, await hashPassword(password), clientIP, role);
        console.log(`User registered with IP ${clientIP}: ${newUser.email}`);

        await logHistory(req, {
            action: HISTORY_ACTIONS.SIGN_UP,
            entity: HISTORY_ENTITIES.USER,
            entityId: newUser.id,
            description: `User registered: ${name} (${email})`,
            actor: newUser,
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: sanitizeUser(newUser),
        });
    } catch (error) {
        console.error('User registration error:', error);
        handleError(res, 500, 'Error registering user');
    }
};

exports.userVerify = async (req, res) => {
    try {
        // The authenticateUser middleware already validated the token
        const user = await model.getUserById(req.user.id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }
        if (user.blocked === USER_STATUS.BLOCKED) {
            return handleError(res, 403, 'Your account has been blocked');
        }

        res.status(200).json({
            message: 'User token verified successfully',
            token: signUserToken(user),
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('User verify token error:', error);
        handleError(res, 500, 'Error verifying user token');
    }
};

exports.getAssemblyToken = async (req, res) => {
    try {
        const user = await model.getUserById(req.user.id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        const assemblyToken = await model.getAssemblyToken(user.id);
        if (!assemblyToken) {
            return handleError(res, 404, 'Assembly token not found');
        }

        res.status(200).json({
            message: 'Assembly token retrieved successfully',
            apiKey: assemblyToken.api_key,
        });
    } catch (error) {
        console.error('Get assembly token error:', error);
        handleError(res, 500, 'Error getting assembly token');
    }
};

exports.createAssemblyToken = async (req, res) => {
    const { apiKey } = req.body;

    if (!apiKey) {
        return handleError(res, 400, 'API key is required');
    }

    try {
        const user = await model.getUserById(req.user.id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // A user has a single token: replace it instead of stacking duplicates
        const existing = await model.getAssemblyToken(user.id);
        const assemblyToken = existing
            ? await model.updateAssemblyToken(existing.id, user.id, apiKey)
            : await model.createAssemblyToken(user.id, apiKey);

        await logHistory(req, {
            action: existing ? HISTORY_ACTIONS.UPDATE : HISTORY_ACTIONS.CREATE,
            entity: HISTORY_ENTITIES.ASSEMBLY_TOKEN,
            entityId: assemblyToken.id,
            description: `Assembly token ${existing ? 'updated' : 'created'} by user: ${user.email}`,
            metadata: { user_id: user.id, user_email: user.email },
            actor: user,
        });

        res.status(200).json({
            message: `Assembly token ${existing ? 'updated' : 'created'} successfully`,
            apiKey: assemblyToken.api_key,
        });
    } catch (error) {
        console.error('Create assembly token error:', error);
        handleError(res, 500, 'Error creating assembly token');
    }
};
