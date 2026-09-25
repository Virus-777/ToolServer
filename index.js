'use strict';

const { loadEnvironment } = require('./config/env');

const SHUTDOWN_TIMEOUT_MS = 10000;

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

async function start() {
    // Works both in development (.env) and inside the pkg executable (embedded config)
    if (!loadEnvironment()) {
        console.error('❌ Failed to load environment variables');
        console.error('❌ Please create a .env file with database configuration');
        process.exit(1);
    }

    // Optional interactive password prompt (see utils/startup-auth.js)
    if (process.env.STARTUP_AUTH_ENABLED === 'true') {
        const { authenticateStartup } = require('./utils/startup-auth');
        const authenticated = await authenticateStartup(
            process.env.STARTUP_PASSWORD || '',
            process.env.STARTUP_PASSWORD_HASHED === 'true',
            parseInt(process.env.STARTUP_MAX_ATTEMPTS || '3', 10)
        );
        if (!authenticated) {
            console.error('❌ Startup authentication failed');
            process.exit(1);
        }
    }

    // Modules below read process.env, so they are required only after the environment is loaded
    const { setupDatabase } = require('./database/setup');
    const { createApp } = require('./app');
    const db = require('./database/db');

    try {
        await setupDatabase();
    } catch (err) {
        console.error('Failed to setup database:', err.message);
        process.exit(1);
    }

    const port = Number(process.env.PORT) || 8085;
    const server = createApp().listen(port, () => {
        console.log(`🚀 Server is running on port ${port}`);
    });

    server.on('error', (err) => {
        console.error('Server error:', err);
        process.exit(1);
    });

    // Finish in-flight requests and release database connections before exiting
    const shutdown = (signal) => {
        console.log(`\n${signal} received, shutting down...`);
        server.close(async () => {
            await db.end().catch(() => {});
            process.exit(0);
        });
        setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS).unref();
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
}

start();
