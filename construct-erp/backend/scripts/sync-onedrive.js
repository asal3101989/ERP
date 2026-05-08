#!/usr/bin/env node
// scripts/sync-onedrive.js
// One-time script: uploads all locally-stored documents that are missing
// OneDrive sync (onedrive_id IS NULL) to OneDrive, then updates the DB.
//
// Usage (run from backend/ directory):
//   node scripts/sync-onedrive.js
//   node scripts/sync-onedrive.js --dry-run   (preview only, no uploads)

const path = require('path');
// Load .env from backend/ regardless of where the script is invoked from
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs   = require('fs');
const { Pool } = require('pg');
const { uploadToOneDrive, isConfigured } = require('../src/services/onedrive.service');

const DRY_RUN = process.argv.includes('--dry-run');

// ── DB connection (same logic as database.js) ─────────────────────────────
const isCloudUrl = process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool(isCloudUrl
  ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'constructerp',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    }
);

async function run() {
  console.log('\n══════════════════════════════════════════');
  console.log('  OneDrive Sync — Local → Cloud');
  console.log('══════════════════════════════════════════');
  if (DRY_RUN) console.log('  ⚠️  DRY RUN — no uploads will happen\n');

  // Check OneDrive is configured
  if (!isConfigured()) {
    console.error('❌ OneDrive is not configured. Check .env for ONEDRIVE_* vars.');
    process.exit(1);
  }

  // Fetch all documents without OneDrive sync
  const { rows } = await pool.query(`
    SELECT d.id, d.file_name, d.local_url, d.module, d.project_id,
           p.name AS project_name
    FROM documents d
    LEFT JOIN projects p ON d.project_id = p.id
    WHERE d.onedrive_id IS NULL
      AND d.local_url IS NOT NULL
    ORDER BY d.created_at ASC
  `);

  if (!rows.length) {
    console.log('✅ All documents are already synced to OneDrive. Nothing to do.');
    await pool.end();
    return;
  }

  console.log(`Found ${rows.length} document(s) not yet synced to OneDrive.\n`);

  let success = 0, failed = 0, missing = 0;
  const errors = [];

  for (const doc of rows) {
    // Resolve local file path
    const localPath = path.join(__dirname, '..', doc.local_url);

    process.stdout.write(`  [${success + failed + missing + 1}/${rows.length}] ${doc.file_name} … `);

    if (!fs.existsSync(localPath)) {
      console.log('⚠️  File not found on disk — skipped');
      missing++;
      continue;
    }

    if (DRY_RUN) {
      console.log('(dry run — would upload)');
      success++;
      continue;
    }

    try {
      const result = await uploadToOneDrive(
        localPath,
        doc.file_name,
        doc.module || 'documents',
        doc.project_name || 'General'
      );

      if (!result) {
        console.log('⚠️  Upload returned null — skipped');
        missing++;
        continue;
      }

      // Update DB with OneDrive metadata
      await pool.query(
        `UPDATE documents
         SET onedrive_id = $1, onedrive_url = $2, onedrive_web_url = $3
         WHERE id = $4`,
        [result.onedrive_id, result.onedrive_url, result.onedrive_web_url, doc.id]
      );

      console.log('✅ synced');
      success++;

    } catch (err) {
      console.log(`❌ ${err.message}`);
      errors.push({ file: doc.file_name, error: err.message });
      failed++;
    }

    // Small delay to avoid throttling Microsoft Graph API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅ Synced:       ${success}`);
  console.log(`  ⚠️  Missing file: ${missing}`);
  console.log(`  ❌ Failed:       ${failed}`);
  console.log('══════════════════════════════════════════\n');

  if (errors.length) {
    console.log('Failed files:');
    errors.forEach(e => console.log(`  • ${e.file}: ${e.error}`));
    console.log('');
  }

  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  pool.end();
  process.exit(1);
});
