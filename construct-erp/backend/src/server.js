// src/server.js
require('dotenv').config();
const { isConfigured } = require('./services/onedrive.service');
const logger = require('./utils/logger');

// OneDrive Configuration Check
if (isConfigured()) {
  logger.info('✅ OneDrive integration configured');
} else {
  logger.warn('⚠️ OneDrive integration NOT configured (check .env)');
}
require('express-async-errors'); // Automatically catch async route errors
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { pool } = require('./config/database');
// Route imports
const authRoutes = require('./routes/auth.routes');
const projectRoutes = require('./routes/project.routes');
const boqRoutes = require('./routes/boq.routes');
const measurementRoutes = require('./routes/measurement.routes');
const raBillRoutes = require('./routes/raBill.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const paymentRoutes = require('./routes/payment.routes');
const vendorRoutes = require('./routes/vendor.routes');
const poRoutes = require('./routes/po.routes');
const poAmendmentRoutes = require('./routes/poAmendment.routes');
const liveRatesRoutes = require('./routes/live-rates.routes');
const grnRoutes = require('./routes/grn.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const workerRoutes = require('./routes/worker.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const payrollRoutes = require('./routes/payroll.routes');
const dprRoutes      = require('./routes/dpr.routes');
const planningRoutes = require('./routes/planning.routes');
const incidentRoutes = require('./routes/incident.routes');
const permitRoutes = require('./routes/permit.routes');
const ppeRoutes = require('./routes/ppe.routes');
const qualityRoutes = require('./routes/quality.routes');
const drawingRoutes = require('./routes/drawings.routes');
const submittalRoutes = require('./routes/submittals.routes');
const meetingRoutes = require('./routes/meetings.routes');
const assetRoutes = require('./routes/asset.routes');
const inventoryAssetRoutes = require('./routes/inventoryAsset.routes');
const itAssetRoutes = require('./routes/itAsset.routes');
const itTicketRoutes = require('./routes/itTicket.routes');
const budgetRoutes = require('./routes/budget.routes');
const mrsRoutes = require('./routes/mrs.routes');
const minRoutes = require('./routes/min.routes');
const bookingRoutes = require('./routes/booking.routes');
const reportRoutes = require('./routes/report.routes');
const uploadRoutes        = require('./routes/upload.routes');
const syncRoutes          = require('./routes/sync.routes');
const aiRoutes            = require('./routes/ai.routes');
const notificationsRoutes = require('./routes/notifications.routes');
const indentRoutes = require('./routes/indent.routes');
const quotationRoutes = require('./routes/quotation.routes');
const subcontractorRoutes = require('./routes/subcontractor.routes');
const usersRoutes  = require('./routes/users.routes');
const licenseRoutes = require('./routes/license.routes');
const materialReconRoutes = require('./routes/materialRecon.routes');
const analyticsRoutes     = require('./routes/analytics.routes');
const variationRoutes     = require('./routes/variation.routes');
const normsRoutes         = require('./routes/norms.routes');
const documentsRoutes     = require('./routes/documents.routes');
const dqsBillsRoutes         = require('./routes/dqs-bills.routes');
const dqsTrackerRoutes       = require('./routes/dqs-tracker.routes');
const dqsTransmittalRoutes   = require('./routes/dqs-transmittal.routes');
const tdsRoutes           = require('./routes/tds.routes');
const hrMastersRoutes     = require('./routes/hr-masters.routes');
const hrEmployeesRoutes   = require('./routes/hr-employees.routes');
const hrLeaveRoutes       = require('./routes/hr-leave.routes');
const hrAttendanceRoutes  = require('./routes/hr-attendance.routes');
const hrSalaryRoutes      = require('./routes/hr-salary.routes');
const hrPayrollRoutes     = require('./routes/hr-payroll.routes');
const hrLoansRoutes       = require('./routes/hr-loans.routes');
const hrExpensesRoutes    = require('./routes/hr-expenses.routes');
const hrAppraisalsRoutes  = require('./routes/hr-appraisals.routes');
const hrImportRoutes      = require('./routes/hr-import.routes');
const hrEsslRoutes        = require('./routes/hr-essl.routes');
const snagRoutes          = require('./routes/snag.routes');
const { tenderRouter, bidRouter } = require('./routes/tender.routes');
const retentionRoutes             = require('./routes/retention.routes');
const chatRoutes                  = require('./routes/chat.routes');

const http   = require('http');
const { Server: SocketIO } = require('socket.io');
const jwt    = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 5000;

// ============================================
// MIDDLEWARE
// ============================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS
app.use(cors({
  origin: (origin, cb) => {
    // no origin = curl, mobile, Render health checks
    if (!origin) return cb(null, true);
    // any localhost port — allow in dev (Vite, HMR, proxy all use different ports)
    if (/^https?:\/\/localhost(:\d+)?\/?$/.test(origin)) return cb(null, true);
    // any Vercel preview or production deploy
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    // explicit production frontend URL
    if (process.env.FRONTEND_URL && origin.startsWith(process.env.FRONTEND_URL)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Compression
app.use(compression());

// Request logging
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving (uploads) — authenticated only
// Requires a valid JWT so private documents cannot be hot-linked
const { authenticate } = require('./middleware/auth');
app.use('/uploads', authenticate, express.static(path.join(__dirname, '../uploads')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 500,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Auth-specific stricter limiter (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many login attempts, try again in 15 minutes.' }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      db: 'connected',
      version: '3.0.0',
      service: 'ConstructERP India'
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', db: 'disconnected', error: err.message });
  }
});

// ============================================
// API ROUTES
// ============================================

const API = '/api/v1';

// Auth
app.use(`${API}/auth`, authLimiter, authRoutes);

// Core
app.use(`${API}/projects`, projectRoutes);

// QS Module
app.use(`${API}/boq`, boqRoutes);
app.use(`${API}/measurements`, measurementRoutes);
app.use(`${API}/ra-bills`, raBillRoutes);
app.use(`${API}/material-recon`, materialReconRoutes);
app.use(`${API}/variations`, variationRoutes);
app.use(`${API}/norms`, normsRoutes);

// Finance
app.use(`${API}/invoices`, invoiceRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/tds`, tdsRoutes);

// Procurement
app.use(`${API}/vendors`, vendorRoutes);
app.use(`${API}/indents`, indentRoutes);
app.use(`${API}/quotations`, quotationRoutes);
app.use(`${API}/purchase-orders`, poRoutes);
app.use(`${API}/procurement/po-amendments`, poAmendmentRoutes);
app.use(`${API}/procurement/live-rates`, liveRatesRoutes);
app.use(`${API}/grn`, grnRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/subcontractors`, subcontractorRoutes);

// Site & HR
app.use(`${API}/workers`, workerRoutes);
app.use(`${API}/attendance`, attendanceRoutes);
app.use(`${API}/payroll`, payrollRoutes);
app.use(`${API}/dpr`,      dprRoutes);
app.use(`${API}/planning`, planningRoutes);

// HSE & Quality
app.use(`${API}/incidents`, incidentRoutes);
app.use(`${API}/permits`, permitRoutes);
app.use(`${API}/ppe`, ppeRoutes);
app.use(`${API}/quality`, qualityRoutes);
app.use(`${API}/quality/drawings`, drawingRoutes);
app.use(`${API}/quality/submittals`, submittalRoutes);
app.use(`${API}/meetings`, meetingRoutes);
app.use(`${API}/snags`, snagRoutes);

// Assets
app.use(`${API}/assets`, assetRoutes);
app.use(`${API}/inventory-assets`, inventoryAssetRoutes);

// IT
app.use(`${API}/it-assets`, itAssetRoutes);
app.use(`${API}/it-tickets`, itTicketRoutes);
app.use(`${API}/licenses`, licenseRoutes);

// Budget
app.use(`${API}/budget`, budgetRoutes);

// Stores
app.use(`${API}/stores/mrs`, mrsRoutes);
app.use(`${API}/stores/min`, minRoutes);

// CRM
app.use(`${API}/bookings`, bookingRoutes);

// Reports & Strategic Analytics
app.use(`${API}/reports`, reportRoutes);
app.use(`${API}/analytics`, analyticsRoutes);

// File upload
app.use(`${API}/upload`, uploadRoutes);

// Documents (cross-module, OneDrive-backed)
app.use(`${API}/documents`, documentsRoutes);

// DQS Invoice Tracker
app.use(`${API}/dqs/bills`, dqsBillsRoutes);
app.use(`${API}/dqs/material-tracker`, dqsTrackerRoutes);
app.use(`${API}/dqs/transmittals`,     dqsTransmittalRoutes);

// DQS Sync (no JWT — key-based, for cross-app data sharing)
app.use(`${API}/sync`, syncRoutes);

// AI Assistant
app.use(`${API}/ai`, aiRoutes);

// Notifications (live alerts from all modules)
app.use(`${API}/notifications`, notificationsRoutes);

// HR & Admin Module (salaried permanent employees)
app.use(`${API}/hr-admin/masters`,     hrMastersRoutes);
app.use(`${API}/hr-admin/employees`,   hrEmployeesRoutes);
app.use(`${API}/hr-admin/leave`,       hrLeaveRoutes);
app.use(`${API}/hr-admin/attendance`,  hrAttendanceRoutes);
app.use(`${API}/hr-admin/salary`,      hrSalaryRoutes);
app.use(`${API}/hr-admin/payroll`,     hrPayrollRoutes);
app.use(`${API}/hr-admin/loans`,       hrLoansRoutes);
app.use(`${API}/hr-admin/expenses`,    hrExpensesRoutes);
app.use(`${API}/hr-admin/appraisals`,  hrAppraisalsRoutes);
app.use(`${API}/hr-admin/import`,      hrImportRoutes);
app.use(`${API}/hr-admin/essl`,        hrEsslRoutes);

// Tender Management
app.use(`${API}/tenders`,             tenderRouter);
app.use(`${API}/bid-opportunities`,   bidRouter);
app.use(`${API}/retention-releases`,  retentionRoutes);

// User / Team Management
app.use(`${API}/users`, usersRoutes);

// ERP Chat
app.use(`${API}/chat`, chatRoutes);

// ============================================
// SOCKET.IO — Real-time Chat
// ============================================
const io = new SocketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

// Auth middleware for Socket.IO
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) return next(new Error('No token'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (e) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`💬 Chat: ${socket.user?.name || socket.user?.id} connected`);

  // Join a channel room
  socket.on('join_channel', (channel) => {
    socket.rooms.forEach(r => { if (r !== socket.id) socket.leave(r); });
    socket.join(channel);
    socket.currentChannel = channel;
  });

  // New message — broadcast to everyone in the channel
  socket.on('send_message', (msg) => {
    // msg already saved via REST POST, just broadcast to others
    socket.to(msg.channel).emit('new_message', msg);
  });

  // Pin toggle
  socket.on('pin_message', ({ id, channel, pinned }) => {
    socket.to(channel).emit('message_pinned', { id, pinned });
  });

  // Reaction
  socket.on('react_message', ({ id, channel, reactions }) => {
    socket.to(channel).emit('message_reacted', { id, reactions });
  });

  // Typing indicator
  socket.on('typing', ({ channel, name }) => {
    socket.to(channel).emit('user_typing', { name });
  });
  socket.on('stop_typing', ({ channel }) => {
    socket.to(channel).emit('user_stop_typing');
  });

  socket.on('disconnect', () => {
    logger.info(`💬 Chat: ${socket.user?.name || socket.user?.id} disconnected`);
  });
});

// ============================================
// ERROR HANDLING
// ============================================

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} — ${err.message} — ${req.originalUrl}`);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ============================================
// START SERVER
// ============================================

if (require.main === module) {
  server.listen(PORT, () => {
    logger.info(`🚀 ConstructERP API running on port ${PORT}`);
    logger.info(`📍 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🏗  India v3.0 — 12 modules active`);
    logger.info(`💬 Socket.IO chat server ready`);

    const { initBackupService } = require('./utils/backup.service');
    initBackupService();
  });
}

module.exports = { app, server, io };
