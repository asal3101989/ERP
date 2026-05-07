// ============================================================
// src/modules/auth/auth.service.ts
// JWT-based authentication with refresh tokens
// ============================================================
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma';
import { AppError, NotFoundError } from '../../lib/errors';
import { auditLog } from '../../lib/audit';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '7d';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    department: string | null;
    employeeId: string | null;
  };
}

export class AuthService {
  /**
   * Login with email + password. Returns token pair.
   */
  async login(email: string, password: string, ipAddress?: string, userAgent?: string): Promise<TokenPair> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      select: {
        id: true, email: true, fullName: true, role: true,
        department: true, employeeId: true, isActive: true,
        passwordHash: true, lastLoginAt: true,
      },
    });

    if (!user) {
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      throw new AppError('Your account has been deactivated. Contact admin.', 401, 'ACCOUNT_INACTIVE');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      auditLog({ userId: user.id, action: 'LOGIN_FAILED', entityType: 'AUTH', ipAddress });
      throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }

    const { passwordHash: _, ...userSafe } = user;

    const accessToken = this.signAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = this.signRefreshToken(user.id);

    // Store refresh token hash in DB
    const hash = await bcrypt.hash(refreshToken, 5);
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Store in a simple session table (or Redis in prod)
    await prisma.$executeRaw`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, user_agent)
      VALUES (${user.id}, ${hash}, NOW() + INTERVAL '7 days', ${ipAddress || null}, ${userAgent || null})
      ON CONFLICT DO NOTHING
    `.catch(() => {}); // Table may not exist in dev — graceful skip

    auditLog({
      userId: user.id,
      action: 'LOGIN',
      entityType: 'AUTH',
      ipAddress,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes in seconds
      user: userSafe,
    };
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    let payload: any;
    try {
      payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as any;
    } catch {
      throw new AppError('Invalid or expired refresh token', 401, 'TOKEN_INVALID');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      throw new AppError('User account not found or inactive', 401, 'ACCOUNT_INACTIVE');
    }

    const accessToken = this.signAccessToken({ userId: user.id, email: user.email, role: user.role });
    return { accessToken, expiresIn: 15 * 60 };
  }

  /**
   * Change own password.
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User', userId);

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new AppError('Current password is incorrect', 400, 'INVALID_PASSWORD');

    if (newPassword.length < 8) {
      throw new AppError('New password must be at least 8 characters', 400, 'WEAK_PASSWORD');
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

    auditLog({ userId, action: 'PASSWORD_CHANGE', entityType: 'AUTH' });
  }

  /**
   * Admin: create new user.
   */
  async createUser(data: {
    email: string; fullName: string; role: string;
    department?: string; phone?: string; employeeId?: string;
    password?: string;
  }, createdById: string) {
    const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');

    const tempPassword = data.password || this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        fullName: data.fullName,
        role: data.role as any,
        department: data.department,
        phone: data.phone,
        employeeId: data.employeeId,
        passwordHash,
      },
      select: { id: true, email: true, fullName: true, role: true, employeeId: true, createdAt: true },
    });

    auditLog({ userId: createdById, action: 'CREATE_USER', entityType: 'USER', entityId: user.id });

    return { user, tempPassword };
  }

  /**
   * List all users (admin only).
   */
  async listUsers(role?: string) {
    return prisma.user.findMany({
      where: { ...(role && { role: role as any }) },
      select: {
        id: true, email: true, fullName: true, role: true,
        department: true, phone: true, employeeId: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { fullName: 'asc' },
    });
  }

  /**
   * Toggle user active state.
   */
  async toggleUserStatus(userId: string, adminId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
    if (!user) throw new NotFoundError('User', userId);

    const newStatus = !user.isActive;
    await prisma.user.update({ where: { id: userId }, data: { isActive: newStatus } });
    auditLog({ userId: adminId, action: 'TOGGLE_USER_STATUS', entityType: 'USER', entityId: userId });
    return newStatus;
  }

  private signAccessToken(payload: { userId: string; email: string; role: string }): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL as any });
  }

  private signRefreshToken(userId: string): string {
    return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL as any });
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$';
    return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }
}
