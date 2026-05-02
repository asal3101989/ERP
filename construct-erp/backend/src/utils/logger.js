// src/utils/logger.js
const { createLogger, format, transports } = require('winston');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

// In production (Docker) logs go to /app/logs (named volume).
// In development logs go to ../../logs relative to this file.
const LOG_DIR = process.env.LOG_DIR || (isProd ? '/app/logs' : path.join(__dirname, '../../logs'));

// Production uses JSON (structured, parseable by log shippers).
// Development uses a colorized human-readable format.
const consoleFormat = isProd
  ? format.combine(
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.json()
    )
  : format.combine(
      format.colorize(),
      format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      format.errors({ stack: true }),
      format.printf(({ level, message, timestamp }) =>
        `${timestamp} [${level}]: ${message}`
      )
    );

const logger = createLogger({
  level: isProd ? 'info' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.json()
  ),
  transports: [
    new transports.Console({ format: consoleFormat }),
    new transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,   // 5 MB
      maxFiles: 5,
    }),
    new transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      maxsize: 10 * 1024 * 1024,  // 10 MB
      maxFiles: 10,
    }),
  ],
});

module.exports = logger;
