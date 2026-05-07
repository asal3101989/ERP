// ============================================================
// src/modules/auth/auth.controller.ts
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';

const service = new AuthService();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(['ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER', 'PROCUREMENT_OFFICER', 'AUDITOR', 'READ_ONLY']),
  department: z.string().optional(),
  phone: z.string().optional(),
  employeeId: z.string().optional(),
  password: z.string().min(8).optional(),
});

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await service.login(email, password, req.ip, req.headers['user-agent']);
    res.json(result);
  } catch (err) { next(err); }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'refreshToken is required' });
      return;
    }
    const result = await service.refreshToken(refreshToken);
    res.json(result);
  } catch (err) { next(err); }
};

export const logout = async (req: Request, res: Response) => {
  // Client discards tokens. In production: blacklist JWT or delete refresh token from DB
  res.json({ message: 'Logged out successfully' });
};

export const me = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await service.listUsers();
    const me = users.find(u => u.id === req.user!.userId);
    res.json(me || req.user);
  } catch (err) { next(err); }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    await service.changePassword(req.user!.userId, currentPassword, newPassword);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { next(err); }
};

export const createUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dto = createUserSchema.parse(req.body);
    const result = await service.createUser(dto, req.user!.userId);
    res.status(201).json(result);
  } catch (err) { next(err); }
};

export const listUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await service.listUsers(req.query.role as string);
    res.json(result);
  } catch (err) { next(err); }
};

export const toggleUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isActive = await service.toggleUserStatus(req.params.id, req.user!.userId);
    res.json({ isActive, message: `User ${isActive ? 'activated' : 'deactivated'}` });
  } catch (err) { next(err); }
};

// ============================================================
// src/modules/auth/auth.routes.ts
// ============================================================
import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/auth.middleware';
import * as ctrl from './auth.controller';

const router = Router();

// Public routes
router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refreshToken);

// Authenticated routes
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.post('/change-password', authenticate, ctrl.changePassword);

// Admin-only user management
router.get('/users', authenticate, authorize('ADMIN'), ctrl.listUsers);
router.post('/users', authenticate, authorize('ADMIN'), ctrl.createUser);
router.patch('/users/:id/toggle-status', authenticate, authorize('ADMIN'), ctrl.toggleUserStatus);

export default router;
