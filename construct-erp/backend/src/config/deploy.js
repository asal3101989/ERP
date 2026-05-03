// backend/src/config/deploy.js
// Run ONCE on a fresh server to set up the full database schema.
// Usage:  node src/config/deploy.js
//
// Order:
//   1. migrate.js              — all base tables (correct FK order)
//   2. mrs_upgrade_v2.js       — MRS 6-stage approval columns
//   3. subcontractor_upgrade_v1.js — subcontractor tables + work_orders extra columns

const { execSync } = require('child_process');
const path = require('path');

function runScript(file) {
  console.log(`\n▶  Running ${file} ...`);
  execSync(`node "${path.join(__dirname, file)}"`, { stdio: 'inherit' });
  console.log(`✅ ${file} completed.`);
}

try {
  console.log('=== ConstructERP — Full Database Setup ===\n');
  runScript('migrate.js');
  runScript('mrs_upgrade_v2.js');
  runScript('subcontractor_upgrade_v1.js');
  console.log('\n🎉 Database setup complete! You can now start the backend server.');
} catch (err) {
  console.error('\n❌ Setup failed:', err.message);
  process.exit(1);
}
