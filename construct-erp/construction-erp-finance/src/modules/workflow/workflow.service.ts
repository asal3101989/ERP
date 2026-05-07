// ============================================================
// src/modules/workflow/workflow.service.ts
// Multi-level approval workflow engine
// ============================================================
import { prisma } from '../../lib/prisma';
import { BusinessRuleError, NotFoundError } from '../../lib/errors';

export class WorkflowService {
  /**
   * Transition an entity's status and log the workflow action.
   * This is the single gateway for all status changes.
   */
  async transitionStatus(
    entityType: string,
    entityId: string,
    fromStatus: string,
    toStatus: string,
    action: string,
    performedBy: string,
    comments?: string,
    attachments?: string[]
  ) {
    const level = this.extractLevel(toStatus);

    // Update the entity status
    const model = this.getModel(entityType);
    const updated = await (prisma as any)[model].update({
      where: { id: entityId },
      data: {
        status: toStatus,
        ...(toStatus === 'APPROVED' && { approvedAt: new Date(), approvedById: performedBy }),
        ...(toStatus === 'REJECTED' && { rejectedAt: new Date(), rejectedById: performedBy }),
      },
    });

    // Log the workflow action
    await prisma.workflowLog.create({
      data: {
        entityType,
        entityId,
        action: action as any,
        fromStatus,
        toStatus,
        level,
        performedBy,
        comments,
        attachments: attachments || [],
      },
    });

    return updated;
  }

  /**
   * Get pending approvals for a specific approver.
   * Used to build the "My Approvals" queue.
   */
  async getPendingApprovalsForUser(approverId: string) {
    // Find what levels this approver can handle and for what amounts
    const rules = await prisma.approvalRule.findMany({
      where: { approverId, isActive: true },
    });

    if (!rules.length) return { invoices: [], payments: [] };

    const levelNumbers = rules.map((r) => r.level);

    const invoices = await prisma.invoice.findMany({
      where: {
        status: {
          in: levelNumbers.map((l) => `PENDING_APPROVAL_L${l}`) as any[],
        },
      },
      include: {
        vendor: { select: { name: true } },
        client: { select: { name: true } },
        project: { select: { name: true } },
        createdBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { invoices, payments: [] };
  }

  /**
   * Get workflow history for an entity.
   */
  async getWorkflowHistory(entityType: string, entityId: string) {
    return prisma.workflowLog.findMany({
      where: { entityType, entityId },
      include: { user: { select: { fullName: true, role: true } } },
      orderBy: { performedAt: 'asc' },
    });
  }

  /**
   * Check for escalations — invoices stuck in approval > N days.
   * Called by a cron job.
   */
  async checkEscalations() {
    const rules = await prisma.approvalRule.findMany({ where: { isActive: true } });

    const escalations = [];
    for (const rule of rules) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - rule.escalationDays);

      const stuck = await prisma.invoice.findMany({
        where: {
          status: `PENDING_APPROVAL_L${rule.level}` as any,
          updatedAt: { lt: cutoffDate },
        },
        include: { vendor: true, project: true },
      });

      if (stuck.length > 0) {
        escalations.push({ rule, stuckInvoices: stuck });
      }
    }

    return escalations;
  }

  private getModel(entityType: string): string {
    const map: Record<string, string> = {
      INVOICE: 'invoice',
      PAYMENT: 'payment',
      BUDGET: 'budget',
    };
    const model = map[entityType];
    if (!model) throw new NotFoundError('Entity type', entityType);
    return model;
  }

  private extractLevel(status: string): number | null {
    const match = status.match(/PENDING_APPROVAL_L(\d)/);
    return match ? parseInt(match[1]) : null;
  }
}

// ============================================================
// src/lib/bank-validation.ts
// Indian bank account + IFSC validation
// APIs: RazorpayX, Cashfree, or free IFSC API
// ============================================================
import https from 'https';

/**
 * Validate IFSC code format (regex) + existence via public API.
 * Production: Use RazorpayX /validateVPA or Cashfree /payout/v1/validation/bankDetails
 */
export async function validateIFSC(ifscCode: string): Promise<boolean> {
  // Step 1: Format validation
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  if (!ifscRegex.test(ifscCode.toUpperCase())) {
    return false;
  }

  // Step 2: API lookup (razorpay IFSC or ifsc.razorpay.com)
  try {
    const data = await fetchJSON(`https://ifsc.razorpay.com/${ifscCode}`);
    return !!data?.BANK;
  } catch {
    // Fallback: format check only (fail-open for network errors)
    return true;
  }
}

/**
 * Validate Indian bank account via penny drop.
 * Uses Cashfree Payout API (production).
 */
export async function validateBankAccount(
  accountNumber: string,
  ifscCode: string
): Promise<{ valid: boolean; accountHolderName?: string; bank?: string }> {
  // Placeholder — integrate with Cashfree/RazorpayX in production
  // POST https://payout-gamma.cashfree.com/payout/v1/validation/bankDetails
  // Headers: X-Client-Id, X-Client-Secret
  // Body: { bank_account, ifsc }

  const accountRegex = /^\d{9,18}$/;
  if (!accountRegex.test(accountNumber)) {
    return { valid: false };
  }
  return { valid: true };  // Mock — replace with real API call
}

/**
 * Validate GST number format.
 */
export function validateGSTIN(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
}

/**
 * Validate PAN number.
 */
export function validatePAN(pan: string): boolean {
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase());
}

function fetchJSON(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON')); }
      });
    }).on('error', reject);
  });
}
