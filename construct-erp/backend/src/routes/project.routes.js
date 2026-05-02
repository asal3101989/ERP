// src/routes/project.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/project.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/', ctrl.getProjects);
router.post('/', authorize('super_admin','admin'), ctrl.createProject);
router.get('/:id', ctrl.getProject);
router.get('/:id/dashboard', ctrl.getProjectDashboard);
router.put('/:id', authorize('super_admin','admin','project_manager'), ctrl.updateProject);
router.delete('/:id', authorize('super_admin','admin'), ctrl.deleteProject);

module.exports = router;
