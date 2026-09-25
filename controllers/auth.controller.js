'use strict';

const model = require('../database/model');
const { handleError, sanitizeUser } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');
const { logHistory } = require('../utils/history');
const { signLegacyToken, hashPassword, verifyPassword } = require('../config/auth');
const { HISTORY_ACTIONS, HISTORY_ENTITIES, USER_ROLES, USER_STATUS } = require('../config/constants');

/**
 * Legacy authentication + user management (/api/auth).
 * Tokens issued here are verified by the `jwt` passport strategy.
 */

exports.register = async (req, res) => {
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
        console.error('Registration error:', error);
        handleError(res, 500, 'Error registering user');
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await model.getUserByEmail(email);
        if (!user) {
            return handleError(res, 401, 'Invalid email');
        }
        if (user.blocked === USER_STATUS.BLOCKED) {
            return handleError(res, 403, 'Your account has been blocked');
        }
        if (!(await model.isEmailAllowed(email))) {
            return handleError(res, 403, 'Your email is not in the allowed list. Please contact an administrator.');
        }
        if (!(await verifyPassword(password, user.password))) {
            return handleError(res, 401, 'Invalid password');
        }

        const token = signLegacyToken(user);

        await logHistory(req, {
            action: HISTORY_ACTIONS.LOGIN,
            entity: HISTORY_ENTITIES.USER,
            entityId: user.id,
            description: `User logged in: ${user.email}`,
            actor: user,
        });

        res.status(200).json({
            message: 'Login successful',
            token,
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('Login error:', error);
        handleError(res, 500, 'Error logging in');
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await model.getUsers();
        res.status(200).json({ users: users.map(sanitizeUser) });
    } catch (error) {
        console.error('Get users error:', error);
        handleError(res, 500, 'Error fetching users');
    }
};

exports.getUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await model.getUserById(id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        res.status(200).json({ user: sanitizeUser(user) });
    } catch (error) {
        console.error('Get user error:', error);
        handleError(res, 500, 'Error fetching user');
    }
};

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, registration_ip } = req.body;

    try {
        const existingUser = await model.getUserById(id);
        if (!existingUser) {
            return handleError(res, 404, 'User not found');
        }

        if (!name || !email) {
            return handleError(res, 400, 'Name and email are required');
        }

        if (email !== existingUser.email && (await model.getUserByEmail(email))) {
            return handleError(res, 400, 'Email already in use');
        }

        const updatedUser = await model.updateUser(id, name, email, registration_ip || null, existingUser.role);

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.USER,
            entityId: id,
            description: `User updated: ${name} (${email})`,
            metadata: { user_id: id, name, email },
        });

        res.status(200).json({
            message: 'User updated successfully',
            user: sanitizeUser(updatedUser),
        });
    } catch (error) {
        console.error('Update user error:', error);
        handleError(res, 500, 'Error updating user');
    }
};

exports.deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await model.getUserById(id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        await model.deleteUser(id);

        await logHistory(req, {
            action: HISTORY_ACTIONS.DELETE,
            entity: HISTORY_ENTITIES.USER,
            entityId: id,
            description: `User deleted: ${user.email}`,
            metadata: { user_id: id, email: user.email },
        });

        res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        handleError(res, 500, 'Error deleting user');
    }
};

exports.toggleBlock = async (req, res) => {
    const { id } = req.params;
    const blocked = Number(req.body.blocked);

    if (blocked !== USER_STATUS.BLOCKED && blocked !== USER_STATUS.ACTIVE) {
        return handleError(res, 400, 'blocked must be 0 (blocked) or 1 (active)');
    }

    try {
        const user = await model.getUserById(id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        const updatedUser = await model.toggleUserBlock(id, blocked);
        const verb = blocked === USER_STATUS.BLOCKED ? 'blocked' : 'unblocked';

        await logHistory(req, {
            action: HISTORY_ACTIONS.UPDATE,
            entity: HISTORY_ENTITIES.USER,
            entityId: id,
            description: `User ${verb}: ${updatedUser.email}`,
            metadata: { user_id: id, blocked, email: updatedUser.email },
        });

        res.status(200).json({
            message: `User ${verb} successfully`,
            user: sanitizeUser(updatedUser),
        });
    } catch (error) {
        console.error('Toggle block error:', error);
        handleError(res, 500, 'Error toggling user block status');
    }
};

exports.verify = async (req, res) => {
    try {
        // The authenticate middleware already validated the token
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
            message: 'Token verified successfully',
            token: signLegacyToken(user),
            user: sanitizeUser(user),
        });
    } catch (error) {
        console.error('Verify token error:', error);
        handleError(res, 500, 'Error verifying token');
    }
};

exports.getUserByIP = async (req, res) => {
    const { ip } = req.params;

    try {
        const user = await model.getUserByIP(ip);
        if (!user) {
            return handleError(res, 404, 'User not found for this IP address');
        }

        res.status(200).json({ user: sanitizeUser(user) });
    } catch (error) {
        console.error('Get user by IP error:', error);
        handleError(res, 500, 'Error fetching user by IP');
    }
};
