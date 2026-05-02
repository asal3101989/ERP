const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const logger = require('./logger');

// Prefer the env var (set in .env or docker-compose); fall back to 'pg_dump'
// which works on Linux/Docker where pg_dump is in PATH.
// On Windows, set PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe in .env
// Prefer the env var (set in .env or docker-compose); fall back to 'pg_dump'
// which works on Linux/Docker where pg_dump is in PATH.
// On Windows, set PG_DUMP_PATH=C:\Program Files\PostgreSQL\18\bin\pg_dump.exe in .env
const PG_DUMP_PATH = process.env.PG_DUMP_PATH || 'pg_dump';
// BACKUP_DIR is set to /app/backups in docker-compose (named volume — survives restarts).
// Falls back to a local path for development.
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../../backups');

/**
 * Perform a database backup using pg_dump
 */
const performBackup = () => {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `backup_${timestamp}.sql`;
    const filePath = path.join(BACKUP_DIR, fileName);

    logger.info(`💾 Starting automated database backup: ${fileName}...`);

    const env = {
      ...process.env,
      PGPASSWORD: process.env.DB_PASSWORD
    };

    const dump = spawn(PG_DUMP_PATH, [
      '-h', process.env.DB_HOST || 'localhost',
      '-p', process.env.DB_PORT || '5432',
      '-U', process.env.DB_USER || 'postgres',
      '-f', filePath,
      process.env.DB_NAME || 'construct_erp'
    ], { env });

    dump.stdout.on('data', (data) => {
      // logger.debug(`pg_dump: ${data}`);
    });

    dump.stderr.on('data', (data) => {
      const msg = data.toString();
      if (!msg.includes('checking version')) {
        logger.warn(`pg_dump warning: ${msg}`);
      }
    });

    dump.on('close', (code) => {
      if (code === 0) {
        logger.info(`✅ Backup successful: ${filePath}`);
        rotateBackups();
        resolve(filePath);
      } else {
        logger.error(`❌ pg_dump process exited with code ${code}`);
        reject(new Error(`pg_dump failed with code ${code}`));
      }
    });
  });
};

/**
 * Delete backups older than 7 days
 */
const rotateBackups = () => {
  try {
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    const expiry = 7 * 24 * 60 * 60 * 1000; // 7 days

    files.forEach(file => {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > expiry) {
        fs.unlinkSync(filePath);
        logger.info(`🗑️ Rotated old backup: ${file}`);
      }
    });
  } catch (err) {
    logger.error(`Error rotating backups: ${err.message}`);
  }
};

/**
 * Initialize the backup schedule
 */
const initBackupService = () => {
  // Schedule: Every day at 02:00 AM
  cron.schedule('0 2 * * *', () => {
    logger.info('⏰ Scheduled backup triggered...');
    performBackup().catch(err => {
      logger.error(`Scheduled backup failed: ${err.message}`);
    });
  });

  logger.info('🛡️ Automated Backup Service initialized (Schedule: 02:00 AM daily, Retention: 7 days)');
  
  // Optional: Run a backup immediately if the backups folder is empty (fresh deploy)
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith('.sql'));
    if (files.length === 0) {
      logger.info('🚀 First run: Triggering initial safety backup...');
      performBackup().catch(err => logger.error(`Initial backup failed: ${err.message}`));
    }
  } catch (err) {
    logger.warn(`Could not check backup directory: ${err.message}`);
  }
};

module.exports = {
  performBackup,
  initBackupService
};
