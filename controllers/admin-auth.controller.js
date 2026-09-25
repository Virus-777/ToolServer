'use strict';

const model = require('../database/model');
const { handleError, sanitizeUser } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');
const { logHistory } = require('../utils/history');
const { signAdminToken, hashPassword, verifyPassword } = require('../config/auth');
const { HISTORY_ACTIONS, HISTORY_ENTITIES, USER_ROLES, USER_STATUS } = require('../config/constants');

/**
 * Dashboard (admin) authentication (/api/admin).
 * Tokens issued here are verified by the `admin-jwt` passport strategy.
 */

exports.adminLogin = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await model.getUserByEmail(email);
        if (!user) {
            return handleError(res, 401, 'Invalid email');
        }
        if (user.blocked === USER_STATUS.BLOCKED) {
            return handleError(res, 403, 'Your account has been blocked');
        }
        if (user.role !== USER_ROLES.ADMIN) {
            return handleError(res, 403, 'Access denied. Admin privileges required.');
        }
        if (!(await verifyPassword(password, user.password))) {
            return handleError(res, 401, 'Invalid password');
        }

        const token = signAdminToken(user);

        await logHistory(req, {
            action: HISTORY_ACTIONS.LOGIN,
            entity: HISTORY_ENTITIES.USER,
            entityId: user.id,
            description: `Admin logged in: ${user.email}`,
            actor: user,
        });

        res.status(200).json({
            message: 'Admin login successful',
            token,
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('Admin login error:', error);
        handleError(res, 500, 'Error logging in as admin');
    }
};

exports.adminRegister = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        const clientIP = getClientIP(req);

        if (await model.getUserByEmail(email)) {
            return handleError(res, 400, 'User with this email already exists');
        }

        // Accounts created through the admin endpoint are always administrators
        const newUser = await model.createUser(name, email, await hashPassword(password), clientIP, USER_ROLES.ADMIN);
        console.log(`Admin registered with IP ${clientIP}: ${newUser.email}`);

        await logHistory(req, {
            action: HISTORY_ACTIONS.SIGN_UP,
            entity: HISTORY_ENTITIES.USER,
            entityId: newUser.id,
            description: `Admin registered: ${name} (${email})`,
            actor: newUser,
        });

        res.status(201).json({
            message: 'Admin registered successfully',
            user: sanitizeUser(newUser),
        });
    } catch (error) {
        console.error('Admin registration error:', error);
        handleError(res, 500, 'Error registering admin');
    }
};

exports.adminVerify = async (req, res) => {
    try {
        // The authenticateAdmin middleware already validated the token
        const user = await model.getUserById(req.user.id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }
        if (user.blocked === USER_STATUS.BLOCKED) {
            return handleError(res, 403, 'Your account has been blocked');
        }
        if (user.role !== USER_ROLES.ADMIN) {
            return handleError(res, 403, 'Access denied. Admin privileges required.');
        }

        res.status(200).json({
            message: 'Admin token verified successfully',
            token: signAdminToken(user),
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('Admin verify token error:', error);
        handleError(res, 500, 'Error verifying admin token');
    }
};
