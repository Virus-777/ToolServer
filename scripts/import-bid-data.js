'use strict';

/**
 * Import jobs from a bid spreadsheet (bid.xlsx by default) into the jobs table.
 *
 * Usage: node scripts/import-bid-data.js [path/to/file.xlsx]
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { loadEnvironment } = require('../config/env');

if (!loadEnvironment()) {
    process.exit(1);
}

const db = require('../database/db');
const { normalizeUrl } = require('../utils/url.utils');
const { todayInTimeZone } = require('../utils/date.utils');
const { JOBS_TIME_ZONE } = require('../config/constants');

/** Excel serial date -> ISO timestamp (accounts for Excel's 1900 leap-year bug). */
function convertExcelDate(excelDate) {
    if (!excelDate) {
        return null;
    }
    if (excelDate instanceof Date) {
        return excelDate.toISOString();
    }
    const excelEpoch = new Date(1900, 0, 1);
    const days = Number(excelDate) - 2;
    return new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function importBidData(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    const workbook = XLSX.readFile(filePath);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Processing ${rows.length} rows from ${filePath}...`);

    const results = { totalRows: rows.length, inserted: 0, errors: [] };
    const client = await db.getClient();

    try {
        for (const row of rows) {
            try {
                const url = row.url || null;
                const createdAt = convertExcelDate(row.created_at);
                const updatedAt = convertExcelDate(row.updated_at);
                const date = row.date || (createdAt ? createdAt.slice(0, 10) : todayInTimeZone(JOBS_TIME_ZONE));

                const insert = await client.query(
                    `INSERT INTO jobs (title, company, tech, url, normalized_url, description, date, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP), COALESCE($9, CURRENT_TIMESTAMP))
                     RETURNING id`,
                    [row.title || null, row.company || null, row.tech || null, url, url ? normalizeUrl(url) : null,
                        row.description || null, date, createdAt, updatedAt]
                );

                results.inserted += 1;
                console.log(`Inserted job ID ${insert.rows[0].id}: ${row.title} at ${row.company}`);
            } catch (error) {
                results.errors.push({ row: row.id || 'unknown', error: error.message });
                console.error(`Error processing row ${row.id}:`, error.message);
            }
        }
    } finally {
        client.release();
    }

    console.log('\nImport completed:');
    console.log(`- Total rows processed: ${results.totalRows}`);
    console.log(`- Successfully inserted: ${results.inserted}`);
    console.log(`- Errors: ${results.errors.length}`);

    return results;
}

const file = path.resolve(process.argv[2] || 'bid.xlsx');

importBidData(file)
    .catch((error) => {
        console.error('Error importing bid data:', error.message);
        process.exitCode = 1;
    })
    .finally(() => db.end());
