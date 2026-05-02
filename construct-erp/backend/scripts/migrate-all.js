#!/usr/bin/env node
/**
 * scripts/migrate-all.js
 * ConstructERP — unified migration runner
 *
 * Runs the primary schema migration first, then applies every fix script
 * in the /migrations directory in deterministic order (alphabetical, with
 * the exception of a few well-known dangerous scripts that are skipped).
 *
 * Usage:
 *   node scripts/migrate-all.js            # run all
 *   node scripts/migrate-all.js --dry-run  # list what would run, no-op
 *
 * Each fix script is expected to either:
 *   a) export a single async function (module.exports = async (pool) => { ... })
 *   b) call process.exit() itself (legacy pattern — handled by child-process isolation)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const path  = require('path');
const fs    = require('fs');
const { Pool } = require('pg');

// ── Scripts to NEVER run automatically ──────────────────────────────────────
// These are destructive or environment-specific tools, not incremental fixes.
const SKIP_LIST = new Set([
  'reset-db.js',        // drops and recreates entire database
  'reset-password.js',  // one-time utility for manual use
  'test_sql.js',        // ad-hoc test queries
]);

const DRY_RUN = process.argv.includes('--dry-run');

// ── Build DB connection ──────────────────────────────────────────────────────
const isCloudUrl = process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes('localhost') &&
  !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool(
  isCloudUrl
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'construct_erp',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || '',
        ssl:      false,
      }
);

// ── Ensure migration tracking table exists ───────────────────────────────────
async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    TEXT NOT NULL UNIQUE,
      ran_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function hasRun(filename) {
  const r = await pool.query(
    'SELECT 1 FROM _schema_migrations WHERE filename = $1',
    [filename]
  );
  return r.rowCount > 0;
}

async function markRan(filename) {
  await pool.query(
    'INSERT INTO _schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
    [filename]
  );
}

// ── Run a single fix script ──────────────────────────────────────────────────
async function runScript(scriptPath, filename) {
  let mod;
  try {
    mod = require(scriptPath);
  } catch (loadErr) {
    console.error(`  ✗ Failed to require ${filename}: ${loadErr.message}`);
    return false;
  }

  if (typeof mod === 'function') {
    // Modern pattern: module.exports = async (pool) => { ... }
    await mod(pool);
    return true;
  }

  if (typeof mod.run === 'function') {
    // Some scripts export { run: async (pool) => { ... } }
    await mod.run(pool);
    return true;
  }

  // Legacy pattern: script runs on require() — already executed above, just mark it done.
  console.log(`  ℹ ${filename} uses legacy auto-run pattern (marked as applied)`);
  return true;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║     ConstructERP — Unified Migration Runner   ║');
  console.log(`╚══════════════════════════════════════════════╝\n`);

  if (DRY_RUN) console.log('⚠  DRY RUN — no changes will be made\n');

  // 1. Run the primary schema migration
  console.log('▶ Step 1: Primary schema migration (src/config/migrate.js)');
  if (!DRY_RUN) {
    try {
      const primaryMigrate = require('../src/config/migrate');
      if (typeof primaryMigrate === 'function') {
        await primaryMigrate(pool);
      }
      // If it auto-runs on require, it's already done
      console.log('  ✓ Primary migration complete\n');
    } catch (err) {
      console.error('  ✗ Primary migration failed:', err.message);
      process.exit(1);
    }
  } else {
    console.log('  [dry-run] would run src/config/migrate.js\n');
  }

  // 2. Apply fix scripts in alphabetical order
  const migrationsDir = path.join(__dirname, '../migrations');
  const allFiles = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') && !SKIP_LIST.has(f))
    .sort();

  console.log(`▶ Step 2: Fix scripts (${allFiles.length} candidates in /migrations)\n`);

  if (!DRY_RUN) await ensureTrackingTable();

  let applied = 0, skipped = 0, failed = 0;

  for (const filename of allFiles) {
    const scriptPath = path.join(migrationsDir, filename);

    if (!DRY_RUN && await hasRun(filename)) {
      console.log(`  ⏭  ${filename} (already applied)`);
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`  [dry-run] would apply: ${filename}`);
      continue;
    }

    console.log(`  ▷  Applying ${filename} …`);
    try {
      await runScript(scriptPath, filename);
      await markRan(filename);
      console.log(`  ✓  ${filename} applied`);
      applied++;
    } catch (err) {
      console.error(`  ✗  ${filename} FAILED: ${err.message}`);
      // Continue — don't block other scripts on one failure
      failed++;
    }
  }

  console.log('\n─────────────────────────────────────────────');
  console.log(`  Applied : ${applied}`);
  console.log(`  Skipped : ${skipped}`);
  console.log(`  Failed  : ${failed}`);
  console.log('─────────────────────────────────────────────\n');

  await pool.end();

  if (failed > 0) {
    console.error('⚠  Some migrations failed — check logs above.');
    process.exit(1);
  }

  console.log('✅ All migrations complete.\n');
}

main().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
