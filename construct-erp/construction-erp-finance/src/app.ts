// ============================================================
// src/app.ts — Express Application Entry Point
// ============================================================
import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { json, urlencoded } from 'body-parser';

import { errorHandler } from './middleware/error.middleware';
import { requestLogger } from './middleware/logger.middleware';
import { authenticate } from './middleware/auth.middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import projectRoutes from './modules/projects/project.routes';
import budgetRoutes from './modules/budget/budget.routes';
import vendorRoutes from './modules/vendors/vendor.routes';
import clientRoutes from './modules/clients/client.routes';
import invoiceRoutes from './modules/invoices/invoice.routes';
import paymentRoutes from './modules/payments/payment.routes';
import ledgerRoutes from './modules/ledger/ledger.routes';
import cashFlowRoutes from './modules/cashflow/cashflow.routes';
import payrollRoutes from './modules/payroll/payroll.routes';
import taxRoutes from './modules/taxation/tax.routes';
import reportRoutes from './modules/reports/report.routes';
import workflowRoutes from './modules/workflow/workflow.routes';

const app: Application = express();

// ── Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// ── CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// ── Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts, please try again later.' },
});

app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);

// ── Body parsing
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());

// ── Logging
app.use(morgan('combined'));
app.use(requestLogger);

// ── Health check (unauthenticated)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// ── API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/projects', authenticate, projectRoutes);
app.use('/api/v1/budgets', authenticate, budgetRoutes);
app.use('/api/v1/vendors', authenticate, vendorRoutes);
app.use('/api/v1/clients', authenticate, clientRoutes);
app.use('/api/v1/invoices', authenticate, invoiceRoutes);
app.use('/api/v1/payments', authenticate, paymentRoutes);
app.use('/api/v1/ledger', authenticate, ledgerRoutes);
app.use('/api/v1/cashflow', authenticate, cashFlowRoutes);
app.use('/api/v1/payroll', authenticate, payrollRoutes);
app.use('/api/v1/taxation', authenticate, taxRoutes);
app.use('/api/v1/reports', authenticate, reportRoutes);
app.use('/api/v1/workflow', authenticate, workflowRoutes);

// ── 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler
app.use(errorHandler);

export default app;
