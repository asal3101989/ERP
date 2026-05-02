require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./src/config/database');

async function main() {
  const email   = 'it@bcim.in';
  const newPass = 'Tqs@2026';
  const hash    = await bcrypt.hash(newPass, 12);

  const res = await query(
    `UPDATE users SET password_hash = $1, updated_at = NOW()
     WHERE email = $2 RETURNING id, name, email`,
    [hash, email]
  );

  if (res.rows.length === 0) {
    console.error('❌  User not found:', email);
    process.exit(1);
  }
  console.log('✅  Password reset successfully for:', res.rows[0]);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
