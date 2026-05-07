// ============================================================
// src/server.ts — HTTP server bootstrap
// ============================================================
import 'dotenv/config';
import app from './app';
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

const PORT = parseInt(process.env.PORT || '3001', 10);

async function bootstrap() {
  // Verify DB connection
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connected');
  } catch (err) {
    logger.error('❌ Database connection failed:', err);
    process.exit(1);
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Construction ERP Finance Module running on port ${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`   API base:    http://localhost:${PORT}/api/v1`);
    logger.info(`   Health:      http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`\n${signal} received — shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('Server closed. Database disconnected.');
      process.exit(0);
    });
    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
  });
}

bootstrap();

// ============================================================
// src/lib/logger.ts — Structured logger (winston-compatible stub)
// ============================================================
export const logger = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO]  ${new Date().toISOString()} ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) => console.warn(`[WARN]  ${new Date().toISOString()} ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${new Date().toISOString()} ${msg}`, ...args),
  debug: (msg: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()} ${msg}`, ...args);
    }
  },
};
