// src/routes/subcontractor.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/subcontractor.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

// Dashboard
router.get('/dashboard', ctrl.getDashboard);

// Work Orders
router.get('/work-orders', ctrl.getWorkOrders);
router.post('/work-orders', authorize('super_admin', 'admin', 'project_manager'), ctrl.createWorkOrder);
router.get('/work-orders/:id', ctrl.getWorkOrder);
router.patch('/work-orders/:id', authorize('super_admin', 'admin', 'project_manager'), ctrl.updateWorkOrder);

// Measurements (MB)
router.get('/measurements', ctrl.getMeasurements);
router.post('/measurements', authorize('super_admin', 'admin', 'project_manager', 'site_engineer'), ctrl.createMeasurement);

// Billing
router.post('/bills', authorize('super_admin', 'admin', 'accountant'), ctrl.createBill);
router.get('/bills', ctrl.getBills);
router.get('/bills/:id', ctrl.getBill);
router.patch('/bills/:id', authorize('super_admin', 'admin', 'accountant'), ctrl.updateBill);

module.exports = router;
