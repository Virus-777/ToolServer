const db = require('./db');  // importing the module above
const XLSX = require('xlsx');
const fs = require('fs');

exports.getUsers = async () => {
    const res = await db.query('SELECT * FROM users');
    return res.rows;  // .rows is an array of result rows
}

exports.getUserById = async (id) => {
    const res = await db.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
    );
    return res.rows[0];
}

exports.createUser = async (name, email, password, registration_ip, role = 'user') => {
    const res = await db.query(
        `INSERT INTO users (name, email, password, registration_ip, role) VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [name, email, password, registration_ip, role]
    );
    return res.rows[0];
}

exports.getUserByEmail = async (email) => {
    const res = await db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
    );
    return res.rows[0];
}

exports.updateUser = async (id, name, email, registration_ip, role) => {
    const res = await db.query(
        'UPDATE users SET name = $1, email = $2, registration_ip = $3, role = $4 WHERE id = $5 RETURNING *',
        [name, email, registration_ip, role, id]
    );
    return res.rows[0];
}

exports.deleteUser = async (id) => {
    const res = await db.query(
        'DELETE FROM users WHERE id = $1 RETURNING *',
        [id]
    );
    return res.rows[0];
}

exports.toggleUserBlock = async (id, blocked) => {
    const res = await db.query(
        'UPDATE users SET blocked = $1 WHERE id = $2 RETURNING *',
        [blocked, id]
    );
    return res.rows[0];
}

// Helper function to get user by registration IP
exports.getUserByIP = async (ip) => {
    const res = await db.query(
        'SELECT * FROM users WHERE registration_ip = $1',
        [ip]
    );
    return res.rows[0];
}

// Settings Management Functions
exports.getSettings = async () => {
    const res = await db.query('SELECT * FROM settings ORDER BY created_at DESC');
    return res.rows;
}

exports.getSettingById = async (id) => {
    const res = await db.query(
        'SELECT * FROM settings WHERE id = $1',
        [id]
    );
    return res.rows[0];
}

exports.getSettingByKey = async (key) => {
    const res = await db.query(
        'SELECT * FROM settings WHERE key = $1',
        [key]
    );
    return res.rows[0];
}

exports.createSetting = async (key, value) => {
    const res = await db.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) RETURNING *',
        [key, value]
    );
    return res.rows[0];
}

exports.updateSetting = async (id, key, value) => {
    const res = await db.query(
        'UPDATE settings SET key = $1, value = $2 WHERE id = $3 RETURNING *',
        [key, value, id]
    );
    return res.rows[0];
}

exports.deleteSetting = async (id) => {
    const res = await db.query(
        'DELETE FROM settings WHERE id = $1 RETURNING *',
        [id]
    );
    return res.rows[0];
}

// User Configuration Management Functions
exports.getAllConfigs = async () => {
    const res = await db.query(
        'SELECT * FROM user_configs ORDER BY updated_at DESC'
    );
    return res.rows;
}

exports.getConfigByEmail = async (userEmail) => {
    const res = await db.query(
        'SELECT * FROM user_configs WHERE user_email = $1',
        [userEmail]
    );
    return res.rows[0];
}

exports.createOrUpdateConfig = async (userEmail, field, value) => {
    // First check if config exists
    const existing = await db.query(
        'SELECT * FROM user_configs WHERE user_email = $1',
        [userEmail]
    );

    if (existing.rows.length > 0) {
        // Update existing
        const res = await db.query(
            `UPDATE user_configs SET ${field} = $1, updated_at = CURRENT_TIMESTAMP WHERE user_email = $2 RETURNING *`,
            [value, userEmail]
        );
        return res.rows[0];
    } else {
        // Create new
        const res = await db.query(
            `INSERT INTO user_configs (user_email, ${field}) VALUES ($1, $2) RETURNING *`,
            [userEmail, value]
        );
        return res.rows[0];
    }
}

exports.savePrompt = async (userEmail, prompt) => {
    return exports.createOrUpdateConfig(userEmail, 'prompt', prompt);
}

exports.saveResume = async (userEmail, resume) => {
    return exports.createOrUpdateConfig(userEmail, 'resume', resume);
}

exports.saveTemplate = async (userEmail, templatePath) => {
    return exports.createOrUpdateConfig(userEmail, 'template_path', templatePath);
}

exports.saveFolder = async (userEmail, folderPath) => {
    return exports.createOrUpdateConfig(userEmail, 'folder_path', folderPath);
}

exports.deleteConfig = async (userEmail) => {
    const res = await db.query(
        'DELETE FROM user_configs WHERE user_email = $1 RETURNING *',
        [userEmail]
    );
    return res.rows[0];
}

// Job Management Functions
exports.getJobs = async (date = null, page = 1, limit = 20, search = null, orderDirection = 'ASC') => {
    let query = 'SELECT * FROM jobs';
    let countQuery = 'SELECT COUNT(*) as total FROM jobs';
    let params = [];
    let countParams = [];
    let whereConditions = [];

    if (date) {
        whereConditions.push('date = $' + (params.length + 1));
        params.push(date);
        countParams.push(date);
    }

    if (search) {
        const searchParam = '$' + (params.length + 1);
        whereConditions.push(`(title ILIKE ${searchParam} OR company ILIKE ${searchParam} OR tech ILIKE ${searchParam} OR description ILIKE ${searchParam})`);
        params.push(`%${search}%`);
        countParams.push(`%${search}%`);
    }

    if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
    }

    // Validate and set order direction
    const validDirections = ['ASC', 'DESC'];
    const direction = validDirections.includes(orderDirection.toUpperCase()) ? orderDirection.toUpperCase() : 'ASC';
    query += ` ORDER BY id ${direction}`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [jobsRes, countRes] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
    ]);

    return {
        jobs: jobsRes.rows,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countRes.rows[0].total),
            totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit)
        }
    };
}

exports.getJobsByDate = async (date) => {
    const res = await db.query(
        'SELECT * FROM jobs WHERE date = $1 ORDER BY id ASC',
        [date]
    );
    return res.rows;
}

exports.getJobById = async (jobId) => {
    const res = await db.query(
        'SELECT * FROM jobs WHERE id = $1',
        [jobId]
    );
    return res.rows[0];
}

exports.getJobByUrl = async (url) => {
    const res = await db.query(
        'SELECT * FROM jobs WHERE url = $1',
        [url]
    );
    return res.rows[0];
}

// URL normalization functions from bid_check.js
function extractTargetUrl(url) {
    const urlObj = new URL(url);

    // Handle known redirect patterns
    const redirectDomains = {
        'www.indeed.com': 'jk',
        'www.wiraa.com': 'source'
    };

    if (redirectDomains[urlObj.hostname]) {
        const targetParam = redirectDomains[urlObj.hostname];
        const params = new URLSearchParams(urlObj.search);

        // For Indeed, you might not get the full job URL, just job key
        if (redirectDomains[urlObj.hostname] === 'jk' && params.has('jk')) {
            return `https://${urlObj.hostname}/viewjob?jk=${params.get('jk')}`;
        }

        if (params.has(targetParam)) {
            // Decode the redirect target
            return decodeURIComponent(params.get(targetParam));
        }
    }

    // If not a known redirector, return the original with normalized query
    return normalizeQuery(url);
}

function normalizeQuery(url) {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);

    // Sort query parameters
    const sortedParams = new URLSearchParams();
    const sortedKeys = Array.from(params.keys()).sort();

    for (const key of sortedKeys) {
        sortedParams.append(key, params.get(key));
    }

    urlObj.search = sortedParams.toString();
    return urlObj.toString();
}

function normalizeFinalUrl(url) {
    const urlObj = new URL(url);

    // Remove www. prefix and convert to lowercase
    let hostname = urlObj.hostname.toLowerCase().replace('www.', '');
    let pathname = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash

    // Normalize query parameters
    const params = new URLSearchParams(urlObj.search);
    const sortedParams = new URLSearchParams();
    const sortedKeys = Array.from(params.keys()).sort();

    for (const key of sortedKeys) {
        sortedParams.append(key, params.get(key));
    }

    return `${urlObj.protocol}//${hostname}${pathname}?${sortedParams.toString()}`;
}

function clearLink(link) {
    link = String(link);

    // Remove query parameters for certain domains
    if (link.includes('?') &&
        !link.includes('indeed') &&
        !link.includes('builtin') &&
        !link.includes('wellfound') &&
        !link.includes('recruiting.ultipro') &&
        !link.includes('wiraa')) {
        link = link.split('?')[0];
    }

    // Remove trailing slash
    if (link.endsWith('/')) {
        link = link.slice(0, -1);
    }

    // Remove /apply suffix
    if (link.endsWith('/apply')) {
        link = link.slice(0, -6);
    }

    // Remove /application suffix
    if (link.endsWith('/application')) {
        link = link.slice(0, -12);
    }

    // Handle Indeed URLs
    if (link.includes('www.indeed.com')) {
        link = extractTargetUrl(link);
    }

    return link;
}

// Function to normalize URL using bid_check.js logic
function normalizeUrl(url) {
    try {
        // First clear the link using bid_check logic
        const clearedUrl = clearLink(url);
        // Then normalize the final URL
        return normalizeFinalUrl(clearedUrl);
    } catch (error) {
        // If URL is invalid, return as is
        return url;
    }
}

exports.getJobByNormalizedUrl = async (url) => {
    const normalizedUrl = normalizeUrl(url);
    const res = await db.query(
        'SELECT * FROM jobs WHERE normalized_url = $1',
        [normalizedUrl]
    );
    return res.rows[0];
}

exports.getJobByTitleAndCompany = async (title, company) => {
    const res = await db.query(
        'SELECT * FROM jobs WHERE title = $1 AND company = $2',
        [title, company]
    );
    return res.rows[0];
}

exports.createJob = async (title, company, tech, url, description, date) => {
    const normalizedUrl = url ? normalizeUrl(url) : null;
    const res = await db.query(
        `INSERT INTO jobs (title, company, tech, url, normalized_url, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title, company, tech, url, normalizedUrl, description, date]
    );
    return res.rows[0];
}

exports.updateJob = async (jobId, title, company, date, tech, url, description) => {
    const normalizedUrl = url ? normalizeUrl(url) : null;
    const res = await db.query(
        `UPDATE jobs SET title = $1, company = $2, date = $3, tech = $4, url = $5, normalized_url = $6, description = $7, 
         updated_at = CURRENT_TIMESTAMP WHERE id = $8 RETURNING *`,
        [title, company, date, tech, url, normalizedUrl, description, jobId]
    );
    return res.rows[0];
}

exports.deleteJob = async (jobId) => {
    const res = await db.query(
        'DELETE FROM jobs WHERE id = $1 RETURNING *',
        [jobId]
    );
    return res.rows[0];
}

// Function to read bid.xlsx file and insert data into database
exports.importBidData = async (filePath = 'bid.xlsx') => {
    let client;
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        // Get a single database client for the entire operation
        client = await db.getClient();

        // Read the Excel file
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0]; // Use first sheet
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`Processing ${data.length} rows from ${filePath}...`);

        const results = {
            totalRows: data.length,
            inserted: 0,
            skipped: 0,
            errors: []
        };

        // Process each row
        for (const row of data) {
            try {
                // Map Excel columns to database fields
                const jobId = row.id ? parseInt(row.id) : null;
                const title = row.title || null;
                const company = row.company || null;
                const tech = row.tech || null;
                const url = row.url || null;
                const description = row.description || null;
                
                // Convert Excel serial dates to proper timestamps
                const convertExcelDate = (excelDate) => {
                    if (!excelDate) return null;
                    // Excel serial date: days since 1900-01-01 (with leap year bug)
                    const excelEpoch = new Date(1900, 0, 1);
                    const days = excelDate - 2; // Subtract 2 to account for Excel's leap year bug
                    const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
                    return date.toISOString();
                };
                
                const created_at = convertExcelDate(row.created_at);
                const updated_at = convertExcelDate(row.updated_at);

                // Insert into database
                const normalizedUrl = url ? normalizeUrl(url) : null;
                const insertResult = await client.query(
                    `INSERT INTO jobs (title, company, tech, url, normalized_url, description, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
                    [title, company, tech, url, normalizedUrl, description, created_at, updated_at]
                );
                const insertedId = insertResult.rows[0].id;
                results.inserted++;
                console.log(`Inserted job ID ${insertedId}: ${title} at ${company}`);

            } catch (error) {
                results.errors.push({
                    row: row.id || 'unknown',
                    error: error.message
                });
                console.error(`Error processing row ${row.id}:`, error.message);
            }
        }

        console.log(`\nImport completed:`);
        console.log(`- Total rows processed: ${results.totalRows}`);
        console.log(`- Successfully inserted: ${results.inserted}`);
        console.log(`- Skipped: ${results.skipped}`);
        console.log(`- Errors: ${results.errors.length}`);

        if (results.errors.length > 0) {
            console.log('\nErrors encountered:');
            results.errors.forEach(err => {
                console.log(`  Row ${err.row}: ${err.error}`);
            });
        }

        return results;

    } catch (error) {
        console.error('Error importing bid data:', error.message);
        throw error;
    } finally {
        // Always release the client back to the pool
        if (client) {
            client.release();
        }
    }
}

// Block List Management Functions
exports.getAllBlockListItems = async () => {
    const res = await db.query(
        'SELECT * FROM block_list ORDER BY created_at DESC'
    );
    return res.rows;
}

exports.getBlockListItemById = async (id) => {
    const res = await db.query(
        'SELECT * FROM block_list WHERE id = $1',
        [id]
    );
    return res.rows[0];
}

exports.createBlockListItem = async (companyName, url) => {
    // Normalize URL if provided
    const normalizedUrl = url ? normalizeUrl(url) : null;
    const res = await db.query(
        'INSERT INTO block_list (company_name, url) VALUES ($1, $2) RETURNING *',
        [companyName || null, normalizedUrl]
    );
    return res.rows[0];
}

exports.updateBlockListItem = async (id, companyName, url) => {
    // Normalize URL if provided
    const normalizedUrl = url ? normalizeUrl(url) : null;
    const res = await db.query(
        'UPDATE block_list SET company_name = $1, url = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [companyName || null, normalizedUrl, id]
    );
    return res.rows[0];
}

exports.deleteBlockListItem = async (id) => {
    const res = await db.query(
        'DELETE FROM block_list WHERE id = $1 RETURNING *',
        [id]
    );
    return res.rows[0];
}

// Check if company name or URL is in block list
exports.isBlocked = async (company, url) => {
    let query = 'SELECT * FROM block_list WHERE ';
    let params = [];
    let conditions = [];

    if (company) {
        conditions.push('company_name ILIKE $' + (params.length + 1));
        params.push(`%${company}%`);
    }

    if (url) {
        // Normalize URL for comparison
        const normalizedUrl = normalizeUrl(url);
        // Check both exact match and partial match for URL
        conditions.push('(url = $' + (params.length + 1) + ' OR url ILIKE $' + (params.length + 2) + ')');
        params.push(normalizedUrl, `%${normalizedUrl}%`);
    }

    if (conditions.length === 0) {
        return false;
    }

    query += conditions.join(' OR ');
    const res = await db.query(query, params);
    return res.rows.length > 0;
}

// History Management Functions
exports.createHistoryLog = async (userId, userEmail, actionType, entityType, entityId, description, ipAddress, metadata = null) => {
    const res = await db.query(
        'INSERT INTO history (user_id, user_email, action_type, entity_type, entity_id, description, ip_address, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [userId, userEmail, actionType, entityType, entityId, description, ipAddress, metadata ? JSON.stringify(metadata) : null]
    );
    return res.rows[0];
}

exports.getHistoryLogs = async (page = 1, limit = 50, userId = null, actionType = null, entityType = null) => {
    let query = 'SELECT * FROM history';
    let countQuery = 'SELECT COUNT(*) as total FROM history';
    let params = [];
    let countParams = [];
    let whereConditions = [];

    if (userId) {
        whereConditions.push('user_id = $' + (params.length + 1));
        params.push(userId);
        countParams.push(userId);
    }

    if (actionType) {
        whereConditions.push('action_type = $' + (params.length + 1));
        params.push(actionType);
        countParams.push(actionType);
    }

    if (entityType) {
        whereConditions.push('entity_type = $' + (params.length + 1));
        params.push(entityType);
        countParams.push(entityType);
    }

    if (whereConditions.length > 0) {
        const whereClause = ' WHERE ' + whereConditions.join(' AND ');
        query += whereClause;
        countQuery += whereClause;
    }

    query += ' ORDER BY created_at DESC';

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const [logsRes, countRes] = await Promise.all([
        db.query(query, params),
        db.query(countQuery, countParams)
    ]);

    return {
        logs: logsRes.rows,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: parseInt(countRes.rows[0].total),
            totalPages: Math.ceil(parseInt(countRes.rows[0].total) / limit)
        }
    };
}

exports.getHistoryLogById = async (id) => {
    const res = await db.query(
        'SELECT * FROM history WHERE id = $1',
        [id]
    );
    return res.rows[0];
}

// Allowed Email Management Functions
exports.getAllowedEmails = async () => {
    const res = await db.query(
        'SELECT * FROM allowed_emails ORDER BY created_at DESC'
    );
    return res.rows;
}

exports.getAllowedEmailById = async (id) => {
    const res = await db.query(
        'SELECT * FROM allowed_emails WHERE id = $1',
        [id]
    );
    return res.rows[0];
}

exports.getAllowedEmailByEmail = async (email) => {
    const res = await db.query(
        'SELECT * FROM allowed_emails WHERE email = $1',
        [email]
    );
    return res.rows[0];
}

exports.createAllowedEmail = async (email) => {
    const res = await db.query(
        'INSERT INTO allowed_emails (email) VALUES ($1) RETURNING *',
        [email]
    );
    return res.rows[0];
}

exports.updateAllowedEmail = async (id, email) => {
    const res = await db.query(
        'UPDATE allowed_emails SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [email, id]
    );
    return res.rows[0];
}

exports.deleteAllowedEmail = async (id) => {
    const res = await db.query(
        'DELETE FROM allowed_emails WHERE id = $1 RETURNING *',
        [id]
    );
    return res.rows[0];
}

exports.isEmailAllowed = async (email) => {
    const res = await db.query(
        'SELECT * FROM allowed_emails WHERE email = $1',
        [email]
    );
    return res.rows.length > 0;
}

// Assembly Token Management Functions
exports.getAllAssemblyTokens = async () => {
    const res = await db.query(
        `SELECT at.*, u.name as user_name, u.email as user_email 
         FROM assembly_tokens at 
         LEFT JOIN users u ON at.user_id = u.id 
         ORDER BY at.created_at DESC`
    );
    return res.rows;
}

exports.getAssemblyTokenById = async (id) => {
    const res = await db.query(
        `SELECT at.*, u.name as user_name, u.email as user_email 
         FROM assembly_tokens at 
         LEFT JOIN users u ON at.user_id = u.id 
         WHERE at.id = $1`,
        [id]
    );
    return res.rows[0];
}

exports.getAssemblyToken = async (userId) => {
    const res = await db.query(
        'SELECT * FROM assembly_tokens WHERE user_id = $1',
        [userId]
    );
    return res.rows[0];
}

exports.createAssemblyToken = async (userId, apiKey) => {
    const res = await db.query(
        'INSERT INTO assembly_tokens (user_id, api_key) VALUES ($1, $2) RETURNING *',
        [userId, apiKey]
    );
    return res.rows[0];
}

exports.updateAssemblyToken = async (id, userId, apiKey) => {
    const res = await db.query(
        'UPDATE assembly_tokens SET user_id = $1, api_key = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
        [userId, apiKey, id]
    );
    return res.rows[0];
}

exports.deleteAssemblyToken = async (id) => {
    const res = await db.query(
        'DELETE FROM assembly_tokens WHERE id = $1 RETURNING *',
        [id]
    );
    return res.rows[0];
}