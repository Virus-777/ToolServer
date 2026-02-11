const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

// Main startup function
(async () => {
    // Load environment variables (works in both dev and pkg)
    const { loadEnvironment } = require('./config/env');
    if (!loadEnvironment()) {
        console.error('❌ Failed to load environment variables');
        console.error('❌ Please create a .env file with database configuration');
        process.exit(1);
    }

    // Startup authentication check
    // const { authenticateStartup } = require('./utils/startup-auth');
    // const startupPassword = process.env.STARTUP_PASSWORD || '';
    // const isHashed = process.env.STARTUP_PASSWORD_HASHED === 'true';
    // const maxAttempts = parseInt(process.env.STARTUP_MAX_ATTEMPTS || '3', 10);

    // const authenticated = await authenticateStartup(startupPassword, isHashed, maxAttempts);

    // if (!authenticated) {
    //     console.error('❌ Startup authentication failed');
    //     process.exit(1);
    // }

    const passport = require('./config/passport');
    const authRouter = require('./routers/auth.router');
    const adminAuthRouter = require('./routers/admin-auth.router');
    const userAuthRouter = require('./routers/user-auth.router');
    const ipLookupRouter = require('./routers/ip-lookup.router');
    const gptRouter = require('./routers/gpt.router');
    const configRouter = require('./routers/config.router');
    const jobRouter = require('./routers/job.router');
    const settingsRouter = require('./routers/settings.router');
    const blockListRouter = require('./routers/block-list.router');
    const historyRouter = require('./routers/history.router');
    const allowedEmailRouter = require('./routers/allowed-email.router');
    const { setupDatabase } = require('./database/setup');

    const app = express();
    const PORT = process.env.PORT || 8085;

    // Initialize Passport
    app.use(passport.initialize());

    // Middleware
    app.use(morgan('dev')); // HTTP request logger
    app.use(bodyParser.urlencoded({ extended: true, limit: '500kb'}));
    app.use(bodyParser.json({ limit: '500kb' }));
    app.use(cors());

    // Serve static files from public directory
    app.use(express.static(path.join(__dirname, 'public')));

    // API Routes
    app.use('/api/auth', authRouter); // Legacy auth routes
    app.use('/api/admin', adminAuthRouter); // Admin authentication routes
    app.use('/api/user', userAuthRouter); // User authentication routes
    app.use('/api/ips', ipLookupRouter);
    app.use('/api/gpt', gptRouter);
    app.use('/api/config', configRouter);
    app.use('/api/jobs', jobRouter);
    app.use('/api/settings', settingsRouter);
    app.use('/api/block-list', blockListRouter);
    app.use('/api/history', historyRouter);
    app.use('/api/allowed-emails', allowedEmailRouter);
    
    // 404 handler for unmatched API routes
    app.use('/api', (req, res) => {
        res.status(404).json({ error: 'Route not found' });
    });

    // Serve the React app for all non-API routes (client-side routing)
    // Use app.use() instead of app.get('*') for Express 5 compatibility
    app.use((req, res) => {
        // Serve index.html for all other routes (React Router will handle routing)
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Something went wrong!' });
    });

    // Initialize database and start server
    setupDatabase().then(() => {
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
        
        // Handle server errors
        server.on('error', (err) => {
            console.error('Server error:', err);
        });
        
        // Handle uncaught exceptions
        process.on('uncaughtException', (err) => {
            console.error('Uncaught Exception:', err);
        });
        
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        });
        
    }).catch(err => {
        console.error('Failed to setup database:', err);
        process.exit(1);
    });
})();