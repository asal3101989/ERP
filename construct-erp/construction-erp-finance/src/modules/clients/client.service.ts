// ============================================================
// src/modules/clients/client.service.ts
// Client master + milestone billing + AR management
// ============================================================
import { prisma } from '../../lib/prisma';
import { NotFoundError, ConflictError, BusinessRuleError } from '../../lib/errors';
import { validateGSTIN, validatePAN } from '../../lib/bank-validation';
import { auditLog } from '../../lib/audit';

export class ClientService {
  async createClient(dto: any, createdById: string) {
    const existing = await prisma.client.findUnique({ where: { clientCode: dto.clientCode } });
    if (existing) throw new ConflictError(`Client ${dto.clientCode} already exists`);

    if (dto.gstin && !validateGSTIN(dto.gstin)) {
      throw new BusinessRuleError(`Invalid GSTIN: ${dto.gstin}`);
    }

    const client = await prisma.client.create({
      data: {
        clientCode: dto.clientCode,
        name: dto.name,
        contactPerson: dto.contactPerson,
        email: dto.email,
        phone: dto.phone,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        pincode: dto.pincode,
        gstin: dto.gstin,
        panNumber: dto.panNumber,
        paymentTerms: dto.paymentTerms || 30,
        creditLimit: dto.creditLimit,
      },
    });

    auditLog({ userId: createdById, action: 'CREATE', entityType: 'CLIENT', entityId: client.id });
    return client;
  }

  async createMilestone(clientId: string, dto: any) {
    await this.getClientOrThrow(clientId);
    return prisma.projectMilestone.create({
      data: {
        clientId,
        name: dto.name,
        description: dto.description,
        targetDate: new Date(dto.targetDate),
        billingAmount: dto.billingAmount,
        billingPct: dto.billingPct || 0,
        status: 'PENDING',
      },
    });
  }

  async markMilestoneComplete(milestoneId: string, userId: string) {
    const milestone = await prisma.projectMilestone.findUnique({ where: { id: milestoneId } });
    if (!milestone) throw new NotFoundError('Milestone', milestoneId);
    if (milestone.status === 'BILLED') throw new BusinessRuleError('Milestone already billed');

    return prisma.projectMilestone.update({
      where: { id: milestoneId },
      data: { status: 'COMPLETED', completedDate: new Date() },
    });
  }

  async getARSummary(clientId: string) {
    const invoices = await prisma.invoice.findMany({
      where: { clientId, type: 'CLIENT_INVOICE' },
      include: { project: { select: { name: true, projectCode: true } } },
      orderBy: { invoiceDate: 'desc' },
    });

    const today = new Date();
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };

    for (const inv of invoices.filter(i => Number(i.balanceDue) > 0)) {
      const days = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
      const balance = Number(inv.balanceDue);
      if (days <= 0) aging.current += balance;
      else if (days <= 30) aging.days30 += balance;
      else if (days <= 60) aging.days60 += balance;
      else if (days <= 90) aging.days90 += balance;
      else aging.over90 += balance;
    }

    return {
      invoices,
      aging,
      totalBilled: invoices.reduce((s, i) => s + Number(i.grandTotal), 0),
      totalReceived: invoices.reduce((s, i) => s + Number(i.paidAmount || 0), 0),
      totalOutstanding: invoices.reduce((s, i) => s + Number(i.balanceDue), 0),
    };
  }

  async listClients(search?: string, page = 1, limit = 20) {
    const where: any = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { clientCode: { contains: search, mode: 'insensitive' } },
      ],
    } : {};

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        include: { _count: { select: { invoices: true, projects: true } } },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.client.count({ where }),
    ]);

    return { data: clients, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getClientOrThrow(id: string) {
    const c = await prisma.client.findUnique({
      where: { id },
      include: { projects: { select: { id: true, name: true, projectCode: true, status: true } } },
    });
    if (!c) throw new NotFoundError('Client', id);
    return c;
  }
}

// ============================================================
// src/modules/clients/client.controller.ts + routes
// ============================================================
import { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { authorize } from '../../middleware/auth.middleware';

const clientService = new ClientService();

const createClient = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await clientService.createClient(req.body, req.user!.userId)); }
  catch (err) { next(err); }
};

const getClient = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await clientService.getClientOrThrow(req.params.id)); }
  catch (err) { next(err); }
};

const listClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, page, limit } = req.query as any;
    res.json(await clientService.listClients(search, Number(page) || 1, Number(limit) || 20));
  } catch (err) { next(err); }
};

const createMilestone = async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await clientService.createMilestone(req.params.id, req.body)); }
  catch (err) { next(err); }
};

const completeMilestone = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await clientService.markMilestoneComplete(req.params.milestoneId, req.user!.userId)); }
  catch (err) { next(err); }
};

const getARSummary = async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await clientService.getARSummary(req.params.id)); }
  catch (err) { next(err); }
};

const clientRouter = Router();
clientRouter.get('/', listClients);
clientRouter.get('/:id', getClient);
clientRouter.get('/:id/ar-summary', getARSummary);
clientRouter.post('/', authorize('ADMIN', 'ACCOUNTANT'), createClient);
clientRouter.post('/:id/milestones', authorize('ADMIN', 'ACCOUNTANT', 'PROJECT_MANAGER'), createMilestone);
clientRouter.post('/milestones/:milestoneId/complete', authorize('ADMIN', 'PROJECT_MANAGER'), completeMilestone);

export default clientRouter;
