'use strict';

const { Client } = require('pg');

// When executed standalone (`npm run setup`) the environment is not loaded yet.
if (!process.env.PG_HOST) {
    const { loadEnvironment } = require('../config/env');
    if (!loadEnvironment()) {
        console.error('❌ Cannot run database setup without a valid environment');
        process.exit(1);
    }
}

const baseConfig = {
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT) || 5432,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
};

const dbName = process.env.PG_DATABASE;

/**
 * Idempotent schema statements. Every statement uses IF NOT EXISTS so the
 * server can run them on each start without touching existing data.
 */
const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS users (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        role VARCHAR(20) DEFAULT 'user',
        blocked INT DEFAULT 1,
        registration_ip VARCHAR(45),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        key VARCHAR(100) NOT NULL,
        value VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS user_configs (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_email VARCHAR(100) NOT NULL,
        prompt TEXT,
        resume TEXT,
        template_path VARCHAR(500),
        folder_path VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_email)
    )`,
    `CREATE TABLE IF NOT EXISTS jobs (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        company VARCHAR(200),
        tech VARCHAR(500),
        url TEXT,
        normalized_url TEXT,
        summary TEXT,
        description TEXT,
        date VARCHAR(20) NOT NULL,
        industry INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Columns added after the jobs table already existed in deployments.
    // industry: 0 = software, 1 = civil
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS industry INT NOT NULL DEFAULT 0`,
    // summary: short, human readable digest of the job posting
    `ALTER TABLE jobs ADD COLUMN IF NOT EXISTS summary TEXT`,
    `CREATE TABLE IF NOT EXISTS block_list (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        company_name VARCHAR(500),
        url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CHECK (company_name IS NOT NULL OR url IS NOT NULL)
    )`,
    `CREATE TABLE IF NOT EXISTS history (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INT,
        user_email VARCHAR(100),
        action_type VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT,
        description TEXT,
        ip_address VARCHAR(45),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS allowed_emails (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS assembly_tokens (
        id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        user_id INT NOT NULL,
        api_key VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,
    // Indexes backing the hot query paths (jobs feed by date, history listing)
    `CREATE INDEX IF NOT EXISTS idx_jobs_date_industry ON jobs (date, industry)`,
    `CREATE INDEX IF NOT EXISTS idx_history_created_at ON history (created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_history_user_id ON history (user_id)`,
];

/** Create the application database when it does not exist yet (best effort). */
async function ensureDatabaseExists() {
    const adminClient = new Client({ ...baseConfig, database: 'postgres' });

    try {
        await adminClient.connect();
        console.log('✅ Connected to PostgreSQL');

        const existing = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
        if (existing.rowCount === 0) {
            // Identifiers cannot be parameterised, so quote the name explicitly
            await adminClient.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
            console.log(`🎉 Database "${dbName}" created successfully!`);
        }
    } catch (err) {
        // Not fatal: the account may lack access to the maintenance database
        // while the application database already exists.
        console.warn('⚠️  Could not verify/create database:', err.message);
    } finally {
        await adminClient.end().catch(() => {});
    }
}

/** Apply the schema statements inside a single transaction. */
async function ensureSchema() {
    const appClient = new Client({ ...baseConfig, database: dbName });

    try {
        await appClient.connect();
        await appClient.query('BEGIN');
        for (const statement of SCHEMA_STATEMENTS) {
            await appClient.query(statement);
        }
        await appClient.query('COMMIT');
        console.log('✅ Setup complete!');
    } catch (err) {
        await appClient.query('ROLLBACK').catch(() => {});
        console.error('❌ Error setting up database:', err.message);
        throw err;
    } finally {
        await appClient.end().catch(() => {});
    }
}

async function setupDatabase() {
    await ensureDatabaseExists();
    await ensureSchema();
}

module.exports = {
    setupDatabase,
};
