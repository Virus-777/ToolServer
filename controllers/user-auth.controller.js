const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const model = require('../database/model');
const { handleError } = require('../utils/utils');
const { getClientIP } = require('../utils/ip.utils');

exports.userLogin = async (req, res) => {
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

        // Verify IP address - must match registration IP
        if (user.registration_ip && user.registration_ip !== clientIP && clientIP !== '127.0.0.1') {
            console.warn(`User login attempt from different IP. User: ${email}, Registered IP: ${user.registration_ip}, Request IP: ${clientIP}`);
            return handleError(res, 403, 'Login from this IP address is not allowed');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return handleError(res, 401, 'Invalid password');
        }

        // Generate JWT token with user secret
        const token = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                authType: 'user'
            },
            process.env.JWT_USER_SECRET || process.env.JWT_SECRET || 'user-secret-key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
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
            message: 'User login successful',
            token,
            user
        });
    } catch (error) {
        console.error('User login error:', error);
        handleError(res, 500, 'Error logging in as user');
    }
}

exports.userRegister = async (req, res) => {
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

        // Check if this is the first user (make them admin), otherwise make them regular user
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
        console.error('User registration error:', error);
        handleError(res, 500, 'Error registering user');
    }
}

exports.userVerify = async (req, res) => {
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

        // Generate new JWT token with user secret
        const newToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                role: user.role,
                authType: 'user'
            },
            process.env.JWT_USER_SECRET || process.env.JWT_SECRET || 'user-secret-key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Remove password from response
        delete user.password;

        res.status(200).json({
            message: 'User token verified successfully',
            token: newToken,
            user
        });
    } catch (error) {
        console.error('User verify token error:', error);
        handleError(res, 500, 'Error verifying user token');
    }
}

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
            apiKey: assemblyToken.api_key
        });
    } catch (error) {
        console.error('Get assembly token error:', error);
        handleError(res, 500, 'Error getting assembly token');
    }
}

exports.createAssemblyToken = async (req, res) => {
    try {
        const { apiKey } = req.body;
        const user = await model.getUserById(req.user.id);
        if (!user) {
            return handleError(res, 404, 'User not found');
        }
        const assemblyToken = await model.createAssemblyToken(user.id, apiKey);
        
        // Log history
        const clientIP = getClientIP(req);
        await model.createHistoryLog(
            user.id,
            user.email,
            'create',
            'assembly_token',
            assemblyToken.id,
            `Assembly token created by user: ${user.email}`,
            clientIP,
            { user_id: user.id, user_email: user.email }
        );
        
        res.status(200).json({
            message: 'Assembly token created successfully',
            apiKey: assemblyToken.api_key
        });
    } catch (error) {
        console.error('Create assembly token error:', error);
        handleError(res, 500, 'Error creating assembly token');
    }
}