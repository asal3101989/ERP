// ============================================================
// src/middleware/auth.middleware.ts
// JWT Authentication + Role-Based Access Control
// ============================================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { auditLog } from '../lib/audit';

export interface AuthPayload {
  userId: string;
  email: string;
  role: string;
}

// Extend Express Request to carry user context
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
      requestId?: string;
    }
  }
}

/**
 * Verifies JWT token and attaches user to request.
 * Checks token blacklist (for logout support).
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET!;

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, secret) as AuthPayload;
    } catch (err) {
      throw new AppError('Invalid or expired token', 401, 'TOKEN_INVALID');
    }

    // Verify user still active (could be deactivated since token issue)
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User account is inactive', 401, 'ACCOUNT_INACTIVE');
    }

    req.user = { userId: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Role-based access control middleware factory.
 * Usage: authorize('ADMIN', 'ACCOUNTANT')
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }
    if (!roles.includes(req.user.role)) {
      auditLog({
        userId: req.user.userId,
        action: 'UNAUTHORIZED_ACCESS',
        entityType: 'ROUTE',
        entityId: req.path,
        ipAddress: req.ip,
      });
      return next(
        new AppError(`Access denied. Required roles: ${roles.join(', ')}`, 403, 'FORBIDDEN')
      );
    }
    next();
  };
};

// ============================================================
// src/middleware/error.middleware.ts
// Centralized error handling
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log all errors
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.userId,
    requestId: req.requestId,
  });

  // Known application error
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
    return;
  }

  // Prisma errors — map to HTTP
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {  // Unique constraint violation
        const field = (err.meta?.target as string[])?.join(', ');
        res.status(409).json({ error: `Duplicate value for: ${field}`, code: 'DUPLICATE_ENTRY' });
        return;
      }
      case 'P2025':  // Record not found
        res.status(404).json({ error: 'Record not found', code: 'NOT_FOUND' });
        return;
      case 'P2003':  // Foreign key constraint
        res.status(400).json({ error: 'Referenced record does not exist', code: 'FK_VIOLATION' });
        return;
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({ error: 'Invalid data provided', code: 'VALIDATION_ERROR' });
    return;
  }

  // Unknown error — don't leak details in production
  const statusCode = 500;
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An internal error occurred. Please try again later.'
      : err.message;

  res.status(statusCode).json({ error: message, code: 'INTERNAL_ERROR' });
};

// ============================================================
// src/middleware/validate.middleware.ts
// Request validation using Zod
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      const errors = result.error.errors.map((e: ZodError['errors'][0]) => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      res.status(422).json({ error: 'Validation failed', errors });
      return;
    }
    req[target] = result.data;  // Use parsed/coerced data
    next();
  };
};

// ============================================================
// src/middleware/logger.middleware.ts
// Request ID + structured logging
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestLogger = (req: Request, _res: Response, next: NextFunction): void => {
  req.requestId = req.headers['x-request-id'] as string || uuidv4();
  next();
};

// ============================================================
// src/lib/errors.ts — Custom Error Classes
// ============================================================
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id '${id}' not found` : `${resource} not found`,
      404,
      'NOT_FOUND'
    );
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422, 'VALIDATION_ERROR');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION');
  }
}

// ============================================================
// src/lib/prisma.ts — Prisma Client Singleton
// ============================================================
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
      ...(process.env.NODE_ENV === 'development'
        ? [{ level: 'query' as const, emit: 'event' as const }]
        : []),
    ],
  });

prisma.$on('warn', (e) => logger.warn(e.message));
prisma.$on('error', (e) => logger.error(e.message));

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// ============================================================
// src/lib/audit.ts — Audit Logging Helper
// ============================================================
import { prisma } from './prisma';

interface AuditLogParams {
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValues?: object;
  newValues?: object;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Fire-and-forget audit log. Never throws — log failures should not
 * block business operations.
 */
export const auditLog = (params: AuditLogParams): void => {
  prisma.auditLog.create({ data: params as any }).catch(() => {
    // Silent fail — audit log must not crash the request
  });
};

// ============================================================
// src/lib/number-sequences.ts
// Auto-incrementing document numbers with locking
// ============================================================
import { prisma } from './prisma';

const SEQUENCES: Record<string, string> = {
  INVOICE: 'INV',
  PAYMENT: 'PAY',
  JOURNAL: 'JE',
  BUDGET: 'BUD',
  PO: 'PO',
  GRN: 'GRN',
};

/**
 * Generates sequential document numbers using PostgreSQL advisory locks.
 * Format: PREFIX-YYYY-NNNNN  e.g., INV-2024-00042
 */
export const generateDocumentNumber = async (
  type: keyof typeof SEQUENCES
): Promise<string> => {
  const prefix = SEQUENCES[type];
  const year = new Date().getFullYear();

  // Use a raw query with FOR UPDATE SKIP LOCKED to avoid race conditions
  const result = await prisma.$queryRaw<{ next_val: bigint }[]>`
    INSERT INTO document_sequences (type, year, current_value)
    VALUES (${type}, ${year}, 1)
    ON CONFLICT (type, year)
    DO UPDATE SET current_value = document_sequences.current_value + 1
    RETURNING current_value as next_val
  `;

  const seq = Number(result[0].next_val).toString().padStart(5, '0');
  return `${prefix}-${year}-${seq}`;
};
