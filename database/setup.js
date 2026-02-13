const { Client } = require('pg');
// Load environment variables
const { loadEnvironment } = require('../config/env');
loadEnvironment();

const adminConfig = {
    host: process.env.PG_HOST,
    port: process.env.PG_PORT,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: 'postgres', // connect to default DB first
};

const dbName = process.env.PG_DATABASE;

async function setupDatabase() {
    const adminClient = new Client(adminConfig);

    try {
        await adminClient.connect();
        console.log('✅ Connected to PostgreSQL');

        // Step 1: Create database
        const checkDb = await adminClient.query(
            `SELECT 1 FROM pg_database WHERE datname = $1`,
            [dbName]
        );
        if (checkDb.rowCount === 0) {
            await adminClient.query(`CREATE DATABASE ${dbName}`);
            console.log(`🎉 Database "${dbName}" created successfully!`);
        } else {
            // console.log(`ℹ️ Database "${dbName}" already exists`);
        }
    } catch (err) {
        console.error('❌ Error creating database:', err);
    } finally {
        await adminClient.end();
    }

    // Step 2: Connect to new database
    const appClient = new Client({
        ...adminConfig,
        database: dbName,
    });

    try {
        await appClient.connect();

        // Step 3: Create table
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                role VARCHAR(20) DEFAULT 'user',
                blocked INT DEFAULT 1,
                registration_ip VARCHAR(45),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                key VARCHAR(100) NOT NULL,
                value VARCHAR(500) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS user_configs (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_email VARCHAR(100) NOT NULL,
                prompt TEXT,
                resume TEXT,
                template_path VARCHAR(500),
                folder_path VARCHAR(500),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_email)
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS jobs (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                company VARCHAR(200),
                tech VARCHAR(500),
                url TEXT,
                normalized_url TEXT,
                description TEXT,
                date VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS block_list (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                company_name VARCHAR(500),
                url TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CHECK (company_name IS NOT NULL OR url IS NOT NULL)
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS history (
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
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS allowed_emails (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                email VARCHAR(100) UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        await appClient.query(`
            CREATE TABLE IF NOT EXISTS assembly_tokens (
                id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id INT NOT NULL,
                api_key VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
       
        // console.log('🧩 Tables created successfully!');

        console.log('✅ Setup complete!');
    } catch (err) {
        console.error('❌ Error setting up database:', err);
    } finally {
        await appClient.end();
    }
}

module.exports = {
    setupDatabase
}