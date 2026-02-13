const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');

exports.register = async (req, res) => {
    const { name, email, password } = req.body;

    try {
        // Get client IP address
        const clientIP = getClientIP(req);

        // Check if user already exists with this email
        const existingUser = await model.getUserByEmail(email);
        if (existingUser) {
            return handleError(res, 400, 'User with this email already exists');
        }

        // Check if user already registered from this IP address
        const ipUser = await model.getUserByIP(clientIP);
        if (ipUser) {
            return handleError(res, 403, 'A user has already been registered from this IP address');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Check if this is the first user (make them admin)
        const existingUsers = await model.getUsers();
        const userRole = existingUsers.length === 0 ? 'admin' : 'user';
        
        // Create user with registration IP and role
        const newUser = await model.createUser(name, email, hashedPassword, clientIP, userRole);
        console.log(`User registered with IP ${clientIP}: ${newUser.email}`);

        // Log history
        await model.createHistoryLog(
            newUser.id,
            newUser.email,
            'sign_up',
            'user',
            newUser.id,
            `User registered: ${name} (${email})`,
            clientIP
        );

        // Remove password from response
        delete newUser.password;

        res.status(201).json({
            message: 'User registered successfully',
            user: newUser
        });
    } catch (error) {
        console.error('Registration error:', error);
        handleError(res, 500, 'Error registering user');
    }
}

exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Get client IP address
        const clientIP = getClientIP(req);

        // Find user by email
        const user = await model.getUserByEmail(email);
        if (!user) {
            return handleError(res, 401, 'Invalid email');
        }

        // Check if user is blocked
        if (user.blocked === 0) {
            return handleError(res, 403, 'Your account has been blocked');
        }

        // Check if email is in allowed emails list
        const isEmailAllowed = await model.isEmailAllowed(email);
        if (!isEmailAllowed) {
            return handleError(res, 403, 'Your email is not in the allowed list. Please contact an administrator.');
        }

        // Check if user has admin role
        // if (user.role !== 'admin') {
        //     return handleError(res, 403, 'Access denied. Admin privileges required.');
        // }

        // Verify IP address - must match registration IP
        console.warn(`Login attempt from IP. User: ${email}, Registered IP: ${user.registration_ip}, Request IP: ${clientIP}`);
        // if (user.registration_ip && user.registration_ip !== clientIP && clientIP !== '127.0.0.1') {
        //     console.warn(`Login attempt from different IP. User: ${email}, Registered IP: ${user.registration_ip}, Request IP: ${clientIP}`);
        //     return handleError(res, 403, 'Login from this IP address is not allowed');
        // }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return handleError(res, 401, 'Invalid password');
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Log history
        await model.createHistoryLog(
            user.id,
            user.email,
            'login',
            'user',
            user.id,
            `User logged in: ${user.email}`,
            clientIP
        );

        // Remove password from response
        delete user.password;

        res.status(200).json({
            message: 'Login successful',
            token,
            user
        });
    } catch (error) {
        console.error('Login error:', error);
        handleError(res, 500, 'Error logging in');
    }
}

exports.getUsers = async (req, res) => {
    try {
        const users = await model.getUsers();

        // Remove passwords from response
        const sanitizedUsers = users.map(user => {
            const { password, ...userWithoutPassword } = user;
            return userWithoutPassword;
        });

        res.status(200).json({
            users: sanitizedUsers
        });
    } catch (error) {
        console.error('Get users error:', error);
        handleError(res, 500, 'Error fetching users');
    }
}

exports.getUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await model.getUserById(id);

        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // Remove password from response
        delete user.password;

        res.status(200).json({
            user
        });
    } catch (error) {
        console.error('Get user error:', error);
        handleError(res, 500, 'Error fetching user');
    }
}

exports.updateUser = async (req, res) => {
    const { id } = req.params;
    const { name, email, registration_ip } = req.body;

    try {
        // Check if user exists
        const existingUser = await model.getUserById(id);
        if (!existingUser) {
            return handleError(res, 404, 'User not found');
        }

        // Check if email is already taken by another user
        if (email !== existingUser.email) {
            const emailTaken = await model.getUserByEmail(email);
            if (emailTaken) {
                return handleError(res, 400, 'Email already in use');
            }
        }

        // Update user
        const updatedUser = await model.updateUser(id, name, email, registration_ip, existingUser.role);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'update',
            'user',
            id,
            `User updated: ${name} (${email})`,
            clientIP,
            { user_id: id, name, email }
        );

        // Remove password from response
        delete updatedUser.password;

        res.status(200).json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Update user error:', error);
        handleError(res, 500, 'Error updating user');
    }
}

exports.deleteUser = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await model.getUserById(id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        await model.deleteUser(id);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'delete',
            'user',
            id,
            `User deleted: ${user.email}`,
            clientIP,
            { user_id: id, email: user.email }
        );

        res.status(200).json({
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        handleError(res, 500, 'Error deleting user');
    }
}

exports.toggleBlock = async (req, res) => {
    const { id } = req.params;
    const { blocked } = req.body;

    try {
        const user = await model.getUserById(id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        const updatedUser = await model.toggleUserBlock(id, blocked);

        // Log history
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : null;
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            userId,
            userEmail,
            'update',
            'user',
            id,
            `User ${blocked === 0 ? 'blocked' : 'unblocked'}: ${updatedUser.email}`,
            clientIP,
            { user_id: id, blocked, email: updatedUser.email }
        );

        // Remove password from response
        delete updatedUser.password;

        res.status(200).json({
            message: `User ${blocked === 0 ? 'blocked' : 'unblocked'} successfully`,
            user: updatedUser
        });
    } catch (error) {
        console.error('Toggle block error:', error);
        handleError(res, 500, 'Error toggling user block status');
    }
}

exports.verify = async (req, res) => {
    try {
        // Token is already verified by the authenticate middleware
        // req.user contains the decoded user data
        const user = await model.getUserById(req.user.id);

        if (!user) {
            return handleError(res, 404, 'User not found');
        }

        // Check if user is blocked
        if (user.blocked === 0) {
            return handleError(res, 403, 'Your account has been blocked');
        }

        // Check if user has admin role
        if (user.role !== 'admin') {
            return handleError(res, 403, 'Access denied. Admin privileges required.');
        }

        // Generate new JWT token
        const newToken = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '24h' }
        );

        // Remove password from response
        delete user.password;

        res.status(200).json({
            message: 'Token verified successfully',
            token: newToken,
            user
        });
    } catch (error) {
        console.error('Verify token error:', error);
        handleError(res, 500, 'Error verifying token');
    }
}

exports.getUserByIP = async (req, res) => {
    const { ip } = req.params;
console.log(ip)
    try {
        const user = await model.getUserByIP(ip);

        if (!user) {
            return handleError(res, 404, 'User not found for this IP address');
        }

        // Remove password from response
        delete user.password;

        res.status(200).json({
            user
        });
    } catch (error) {
        console.error('Get user by IP error:', error);
        handleError(res, 500, 'Error fetching user by IP');
    }
}