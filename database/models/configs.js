'use strict';

const db = require('../db');

// Columns of user_configs that can be written individually
const CONFIG_COLUMNS = Object.freeze(['prompt', 'resume', 'template_path', 'folder_path']);

exports.getAllConfigs = async () => {
    const res = await db.query('SELECT * FROM user_configs ORDER BY updated_at DESC');
    return res.rows;
};

exports.getConfigByEmail = async (userEmail) => {
    const res = await db.query('SELECT * FROM user_configs WHERE user_email = $1', [userEmail]);
    return res.rows[0];
};

/**
 * Atomically create or update a single configuration column for a user.
 * `column` is validated against an allow-list because identifiers cannot be
 * parameterised.
 */
exports.upsertConfigField = async (userEmail, column, value) => {
    if (!CONFIG_COLUMNS.includes(column)) {
        throw new Error(`Unknown config column: ${column}`);
    }

    const res = await db.query(
        `INSERT INTO user_configs (user_email, ${column}) VALUES ($1, $2)
         ON CONFLICT (user_email) DO UPDATE
         SET ${column} = EXCLUDED.${column}, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [userEmail, value]
    );
    return res.rows[0];
};

exports.savePrompt = (userEmail, prompt) => exports.upsertConfigField(userEmail, 'prompt', prompt);
exports.saveResume = (userEmail, resume) => exports.upsertConfigField(userEmail, 'resume', resume);
exports.saveTemplate = (userEmail, templatePath) => exports.upsertConfigField(userEmail, 'template_path', templatePath);
exports.saveFolder = (userEmail, folderPath) => exports.upsertConfigField(userEmail, 'folder_path', folderPath);

exports.deleteConfig = async (userEmail) => {
    const res = await db.query('DELETE FROM user_configs WHERE user_email = $1 RETURNING *', [userEmail]);
    return res.rows[0];
};
