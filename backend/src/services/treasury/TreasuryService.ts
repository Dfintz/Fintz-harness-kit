import { AppDataSource } from '../../data-source';
import { CreditPool } from '../../models/CreditPool';
import { CreditTransaction, TransactionType } from '../../models/CreditTransaction';
import { ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { emitToOrganization, emitToUser } from '../../websocket/websocketServer';
import { TenantService } from '../base/TenantService';

// ==================== AUDIT ENUM ====================

export enum TreasuryAuditAction {
  POOL_CREATED = 'pool_created',
  CREDIT_EARNED = 'credit_earned',
  CREDIT_SPENT = 'credit_spent',
  CREDIT_TRANSFERRED = 'credit_transferred',
  DUES_COLLECTED = 'dues_collected',
}

// ==================== DTOs ====================

export interface EarnCreditsDTO {
  amount: number;
  source: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface SpendCreditsDTO {
  amount: number;
  purpose: string;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferCreditsDTO {
  toUserId: string;
  amount: number;
  note?: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  category?: string;
  fromUserId?: string;
  toUserId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface TreasuryStatistics {
  balance: number;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  transactionCount: number;
  recentTransactions: CreditTransaction[];
}

// ==================== SERVICE ====================

/**
 * TreasuryService
 *
 * Core service for organization credit pool management.
 * Handles balance tracking, transactions, transfers, statistics, and leaderboard.
 *
 * CONCURRENCY: Uses SELECT ... FOR UPDATE on credit_pools for safe balance mutations.
 * RUNNING BALANCE: Each CreditTransaction records the pool balance after the operation.
 */
export class TreasuryService extends TenantService<CreditPool> {
  private readonly transactionRepo = AppDataSource.getRepository(CreditTransaction);

  constructor() {
    super(AppDataSource.getRepository(CreditPool), {
      enableCache: true,
      cacheTTL: 60, // 1 minute — financial data should not be stale for long
      cacheCheckPeriod: 30,
    });
  }

  // ==================== AUDIT HELPER ====================

  private audit(
    action: TreasuryAuditAction,
    organizationId: string,
    performedById: string,
    details?: Record<string, unknown>
  ): void {
    logAuditEvent({
      eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
      userId: performedById,
      resource: `treasury/${organizationId}`,
      action,
      message: `Treasury ${action} for org ${organizationId}`,
      metadata: { organizationId, ...details },
    });
  }

  // ==================== POOL MANAGEMENT ====================

  /**
   * Get or create the credit pool for an organization.
   * Each org has exactly one pool (enforced by unique index).
   */
  async getOrCreatePool(organizationId: string, createdBy?: string): Promise<CreditPool> {
    let pool = await this.repository.findOne({
      where: { organizationId },
    });

    if (!pool) {
      pool = this.repository.create({
        organizationId,
        balance: 0,
        currency: 'aUEC',
      });
      pool = await this.repository.save(pool);

      if (createdBy) {
        this.audit(TreasuryAuditAction.POOL_CREATED, organizationId, createdBy);
      }
      logger.info('Credit pool created', { organizationId });
    }

    return pool;
  }

  /**
   * Get the current balance for an organization.
   */
  async getBalance(organizationId: string): Promise<{ balance: number; currency: string }> {
    const pool = await this.getOrCreatePool(organizationId);
    return {
      balance: Number(pool.balance),
      currency: pool.currency,
    };
  }

  // ==================== TRANSACTIONS ====================

  /**
   * Record a credit-earning transaction.
   * Uses SELECT FOR UPDATE to prevent race conditions.
   */
  async earnCredits(
    organizationId: string,
    userId: string,
    dto: EarnCreditsDTO
  ): Promise<CreditTransaction> {
    if (dto.amount <= 0) {
      throw new ValidationError('Earn amount must be positive');
    }

    const txn = await this.recordTransaction(organizationId, userId, {
      type: TransactionType.INCOME,
      amount: dto.amount,
      description: dto.source,
      category: dto.category,
      metadata: dto.metadata,
    });

    this.audit(TreasuryAuditAction.CREDIT_EARNED, organizationId, userId, {
      amount: dto.amount,
      source: dto.source,
    });

    emitToUser(userId, 'treasury:earned', {
      amount: dto.amount,
      balance: Number(txn.balance),
    });

    // Org gets a sanitized event (no balance leak)
    emitToOrganization(organizationId, 'treasury:activity', {
      type: 'earned',
      amount: dto.amount,
    });

    return txn;
  }

  /**
   * Record a credit-spending transaction.
   * Validates sufficient balance before proceeding.
   */
  async spendCredits(
    organizationId: string,
    userId: string,
    dto: SpendCreditsDTO
  ): Promise<CreditTransaction> {
    if (dto.amount <= 0) {
      throw new ValidationError('Spend amount must be positive');
    }

    const txn = await this.recordTransaction(organizationId, userId, {
      type: TransactionType.EXPENSE,
      amount: -dto.amount,
      description: dto.purpose,
      category: dto.category,
      metadata: dto.metadata,
    });

    this.audit(TreasuryAuditAction.CREDIT_SPENT, organizationId, userId, {
      amount: dto.amount,
      purpose: dto.purpose,
    });

    emitToUser(userId, 'treasury:spent', {
      amount: dto.amount,
      balance: Number(txn.balance),
    });

    emitToOrganization(organizationId, 'treasury:activity', {
      type: 'spent',
      amount: dto.amount,
    });

    return txn;
  }

  /**
   * Transfer credits from org pool to a user (logged as expense with toUserId).
   */
  async transferCredits(
    organizationId: string,
    fromUserId: string,
    dto: TransferCreditsDTO
  ): Promise<CreditTransaction> {
    if (dto.amount <= 0) {
      throw new ValidationError('Transfer amount must be positive');
    }

    const txn = await this.recordTransaction(organizationId, fromUserId, {
      type: TransactionType.TRANSFER,
      amount: -dto.amount,
      description: dto.note ?? `Transfer to user`,
      toUserId: dto.toUserId,
      fromUserId,
    });

    this.audit(TreasuryAuditAction.CREDIT_TRANSFERRED, organizationId, fromUserId, {
      amount: dto.amount,
      toUserId: dto.toUserId,
    });

    // Notify involved users only (with balance)
    emitToUser(fromUserId, 'treasury:transferred', {
      amount: dto.amount,
      toUserId: dto.toUserId,
      balance: Number(txn.balance),
    });
    emitToUser(dto.toUserId, 'treasury:received', {
      amount: dto.amount,
      fromUserId,
    });

    // Org gets sanitized event (no balance/user details)
    emitToOrganization(organizationId, 'treasury:activity', {
      type: 'transfer',
      amount: dto.amount,
    });

    return txn;
  }

  /**
   * Core transaction recording with SELECT FOR UPDATE concurrency control.
   * All credit mutations flow through this method.
   */
  private async recordTransaction(
    organizationId: string,
    userId: string,
    opts: {
      type: TransactionType;
      amount: number;
      description: string;
      category?: string;
      fromUserId?: string;
      toUserId?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<CreditTransaction> {
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Lock the pool row for this org
      const poolRows = await queryRunner.query(
        `SELECT * FROM credit_pools WHERE "organizationId" = $1 FOR UPDATE`,
        [organizationId]
      );

      let pool: CreditPool;
      if (poolRows.length === 0) {
        // Create pool inside the transaction
        const insertResult = await queryRunner.query(
          `INSERT INTO credit_pools ("organizationId", "balance", "currency", "createdAt", "updatedAt", "version")
           VALUES ($1, 0, 'aUEC', now(), now(), 1) RETURNING *`,
          [organizationId]
        );
        pool = insertResult[0] as CreditPool;
      } else {
        pool = poolRows[0] as CreditPool;
      }

      const currentBalance = Number(pool.balance);
      const newBalance = currentBalance + opts.amount;

      // Prevent negative balance for expenses/transfers
      if (newBalance < 0) {
        throw new ValidationError(
          `Insufficient balance. Current: ${currentBalance}, Requested: ${Math.abs(opts.amount)}`
        );
      }

      // Update pool balance
      await queryRunner.query(
        `UPDATE credit_pools SET "balance" = $1, "lastTransactionAt" = now(), "updatedAt" = now(), "version" = "version" + 1
         WHERE "id" = $2`,
        [newBalance, pool.id]
      );

      // Insert transaction with running balance
      const txnResult = await queryRunner.query(
        `INSERT INTO credit_transactions
          ("organizationId", "creditPoolId", "type", "amount", "balance", "description",
           "category", "fromUserId", "toUserId", "metadata", "createdBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         RETURNING *`,
        [
          organizationId,
          pool.id,
          opts.type,
          opts.amount,
          newBalance,
          opts.description,
          opts.category ?? null,
          opts.fromUserId ?? null,
          opts.toUserId ?? null,
          opts.metadata ? JSON.stringify(opts.metadata) : null,
          userId,
        ]
      );

      await queryRunner.commitTransaction();

      logger.info('Treasury transaction recorded', {
        organizationId,
        type: opts.type,
        amount: opts.amount,
        newBalance,
      });

      return txnResult[0] as CreditTransaction;
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      logger.error('Treasury transaction failed', {
        error: String(error),
        organizationId,
        type: opts.type,
        amount: opts.amount,
      });
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ==================== QUERIES ====================

  /**
   * Get paginated transaction history for an organization.
   */
  async getTransactions(
    organizationId: string,
    pagination: PaginationOptions,
    filters?: TransactionFilters
  ): Promise<PaginatedResponse<CreditTransaction>> {
    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .where('txn."organizationId" = :orgId', { orgId: organizationId });

    if (filters?.type) {
      qb.andWhere('txn.type = :type', { type: filters.type });
    }
    if (filters?.category) {
      qb.andWhere('txn.category = :category', { category: filters.category });
    }
    if (filters?.fromUserId) {
      qb.andWhere('txn."fromUserId" = :fromUserId', { fromUserId: filters.fromUserId });
    }
    if (filters?.toUserId) {
      qb.andWhere('txn."toUserId" = :toUserId', { toUserId: filters.toUserId });
    }
    if (filters?.startDate) {
      qb.andWhere('txn."createdAt" >= :startDate', { startDate: filters.startDate });
    }
    if (filters?.endDate) {
      qb.andWhere('txn."createdAt" <= :endDate', { endDate: filters.endDate });
    }

    const sortBy = filters?.sortBy === 'amount' ? 'txn.amount' : 'txn.createdAt';
    const sortOrder = filters?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(sortBy, sortOrder);

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get treasury statistics for an organization over a given period.
   */
  async getStatistics(organizationId: string, period?: string): Promise<TreasuryStatistics> {
    const pool = await this.getOrCreatePool(organizationId);

    const qb = this.transactionRepo
      .createQueryBuilder('txn')
      .where('txn."organizationId" = :orgId', { orgId: organizationId });

    if (period) {
      const startDate = this.getPeriodStartDate(period);
      if (startDate) {
        qb.andWhere('txn."createdAt" >= :startDate', { startDate });
      }
    }

    const incomeResult = await qb
      .clone()
      .select('COALESCE(SUM(CASE WHEN txn.amount > 0 THEN txn.amount ELSE 0 END), 0)', 'income')
      .addSelect(
        'COALESCE(SUM(CASE WHEN txn.amount < 0 THEN ABS(txn.amount) ELSE 0 END), 0)',
        'expenses'
      )
      .addSelect('COUNT(*)::int', 'count')
      .getRawOne();

    const recent = await qb.clone().orderBy('txn."createdAt"', 'DESC').take(5).getMany();

    return {
      balance: Number(pool.balance),
      currency: pool.currency,
      totalIncome: Number(incomeResult?.income ?? 0),
      totalExpenses: Number(incomeResult?.expenses ?? 0),
      transactionCount: Number(incomeResult?.count ?? 0),
      recentTransactions: recent,
    };
  }

  /**
   * Get the leaderboard of top contributors by income.
   */
  async getLeaderboard(
    organizationId: string,
    limit: number = 10
  ): Promise<Array<{ userId: string; totalContributed: number; transactionCount: number }>> {
    const result = await this.transactionRepo
      .createQueryBuilder('txn')
      .select('txn."createdBy"', 'userId')
      .addSelect('SUM(txn.amount)', 'totalContributed')
      .addSelect('COUNT(*)::int', 'transactionCount')
      .where('txn."organizationId" = :orgId', { orgId: organizationId })
      .andWhere('txn.amount > 0')
      .groupBy('txn."createdBy"')
      .orderBy('"totalContributed"', 'DESC')
      .limit(limit)
      .getRawMany();

    return result.map((row: Record<string, unknown>) => ({
      userId: String(row.userId),
      totalContributed: Number(row.totalContributed),
      transactionCount: Number(row.transactionCount),
    }));
  }

  // ==================== HELPERS ====================

  private getPeriodStartDate(period: string): Date | null {
    const now = new Date();
    switch (period) {
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return d;
      }
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter': {
        const q = Math.floor(now.getMonth() / 3) * 3;
        return new Date(now.getFullYear(), q, 1);
      }
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return null;
    }
  }
}

// Singleton instance for DI consistency
let treasuryServiceInstance: TreasuryService | null = null;

export function getTreasuryService(): TreasuryService {
  return (treasuryServiceInstance ??= new TreasuryService());
}

