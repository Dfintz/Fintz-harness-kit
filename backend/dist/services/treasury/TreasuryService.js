"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreasuryService = exports.TreasuryAuditAction = void 0;
exports.getTreasuryService = getTreasuryService;
const data_source_1 = require("../../data-source");
const CreditPool_1 = require("../../models/CreditPool");
const CreditTransaction_1 = require("../../models/CreditTransaction");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
var TreasuryAuditAction;
(function (TreasuryAuditAction) {
    TreasuryAuditAction["POOL_CREATED"] = "pool_created";
    TreasuryAuditAction["CREDIT_EARNED"] = "credit_earned";
    TreasuryAuditAction["CREDIT_SPENT"] = "credit_spent";
    TreasuryAuditAction["CREDIT_TRANSFERRED"] = "credit_transferred";
    TreasuryAuditAction["DUES_COLLECTED"] = "dues_collected";
})(TreasuryAuditAction || (exports.TreasuryAuditAction = TreasuryAuditAction = {}));
class TreasuryService extends TenantService_1.TenantService {
    transactionRepo = data_source_1.AppDataSource.getRepository(CreditTransaction_1.CreditTransaction);
    constructor() {
        super(data_source_1.AppDataSource.getRepository(CreditPool_1.CreditPool), {
            enableCache: true,
            cacheTTL: 60,
            cacheCheckPeriod: 30,
        });
    }
    audit(action, organizationId, performedById, details) {
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
            userId: performedById,
            resource: `treasury/${organizationId}`,
            action,
            message: `Treasury ${action} for org ${organizationId}`,
            metadata: { organizationId, ...details },
        });
    }
    async getOrCreatePool(organizationId, createdBy) {
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
            logger_1.logger.info('Credit pool created', { organizationId });
        }
        return pool;
    }
    async getBalance(organizationId) {
        const pool = await this.getOrCreatePool(organizationId);
        return {
            balance: Number(pool.balance),
            currency: pool.currency,
        };
    }
    async earnCredits(organizationId, userId, dto) {
        if (dto.amount <= 0) {
            throw new apiErrors_1.ValidationError('Earn amount must be positive');
        }
        const txn = await this.recordTransaction(organizationId, userId, {
            type: CreditTransaction_1.TransactionType.INCOME,
            amount: dto.amount,
            description: dto.source,
            category: dto.category,
            metadata: dto.metadata,
        });
        this.audit(TreasuryAuditAction.CREDIT_EARNED, organizationId, userId, {
            amount: dto.amount,
            source: dto.source,
        });
        (0, websocketServer_1.emitToUser)(userId, 'treasury:earned', {
            amount: dto.amount,
            balance: Number(txn.balance),
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'treasury:activity', {
            type: 'earned',
            amount: dto.amount,
        });
        return txn;
    }
    async spendCredits(organizationId, userId, dto) {
        if (dto.amount <= 0) {
            throw new apiErrors_1.ValidationError('Spend amount must be positive');
        }
        const txn = await this.recordTransaction(organizationId, userId, {
            type: CreditTransaction_1.TransactionType.EXPENSE,
            amount: -dto.amount,
            description: dto.purpose,
            category: dto.category,
            metadata: dto.metadata,
        });
        this.audit(TreasuryAuditAction.CREDIT_SPENT, organizationId, userId, {
            amount: dto.amount,
            purpose: dto.purpose,
        });
        (0, websocketServer_1.emitToUser)(userId, 'treasury:spent', {
            amount: dto.amount,
            balance: Number(txn.balance),
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'treasury:activity', {
            type: 'spent',
            amount: dto.amount,
        });
        return txn;
    }
    async transferCredits(organizationId, fromUserId, dto) {
        if (dto.amount <= 0) {
            throw new apiErrors_1.ValidationError('Transfer amount must be positive');
        }
        const txn = await this.recordTransaction(organizationId, fromUserId, {
            type: CreditTransaction_1.TransactionType.TRANSFER,
            amount: -dto.amount,
            description: dto.note ?? `Transfer to user`,
            toUserId: dto.toUserId,
            fromUserId,
        });
        this.audit(TreasuryAuditAction.CREDIT_TRANSFERRED, organizationId, fromUserId, {
            amount: dto.amount,
            toUserId: dto.toUserId,
        });
        (0, websocketServer_1.emitToUser)(fromUserId, 'treasury:transferred', {
            amount: dto.amount,
            toUserId: dto.toUserId,
            balance: Number(txn.balance),
        });
        (0, websocketServer_1.emitToUser)(dto.toUserId, 'treasury:received', {
            amount: dto.amount,
            fromUserId,
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'treasury:activity', {
            type: 'transfer',
            amount: dto.amount,
        });
        return txn;
    }
    async recordTransaction(organizationId, userId, opts) {
        const queryRunner = data_source_1.AppDataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            const poolRows = await queryRunner.query(`SELECT * FROM credit_pools WHERE "organizationId" = $1 FOR UPDATE`, [organizationId]);
            let pool;
            if (poolRows.length === 0) {
                const insertResult = await queryRunner.query(`INSERT INTO credit_pools ("organizationId", "balance", "currency", "createdAt", "updatedAt", "version")
           VALUES ($1, 0, 'aUEC', now(), now(), 1) RETURNING *`, [organizationId]);
                pool = insertResult[0];
            }
            else {
                pool = poolRows[0];
            }
            const currentBalance = Number(pool.balance);
            const newBalance = currentBalance + opts.amount;
            if (newBalance < 0) {
                throw new apiErrors_1.ValidationError(`Insufficient balance. Current: ${currentBalance}, Requested: ${Math.abs(opts.amount)}`);
            }
            await queryRunner.query(`UPDATE credit_pools SET "balance" = $1, "lastTransactionAt" = now(), "updatedAt" = now(), "version" = "version" + 1
         WHERE "id" = $2`, [newBalance, pool.id]);
            const txnResult = await queryRunner.query(`INSERT INTO credit_transactions
          ("organizationId", "creditPoolId", "type", "amount", "balance", "description",
           "category", "fromUserId", "toUserId", "metadata", "createdBy", "createdAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
         RETURNING *`, [
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
            ]);
            await queryRunner.commitTransaction();
            logger_1.logger.info('Treasury transaction recorded', {
                organizationId,
                type: opts.type,
                amount: opts.amount,
                newBalance,
            });
            return txnResult[0];
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            logger_1.logger.error('Treasury transaction failed', {
                error: String(error),
                organizationId,
                type: opts.type,
                amount: opts.amount,
            });
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async getTransactions(organizationId, pagination, filters) {
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
    async getStatistics(organizationId, period) {
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
            .addSelect('COALESCE(SUM(CASE WHEN txn.amount < 0 THEN ABS(txn.amount) ELSE 0 END), 0)', 'expenses')
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
    async getLeaderboard(organizationId, limit = 10) {
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
        return result.map((row) => ({
            userId: String(row.userId),
            totalContributed: Number(row.totalContributed),
            transactionCount: Number(row.transactionCount),
        }));
    }
    getPeriodStartDate(period) {
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
exports.TreasuryService = TreasuryService;
let treasuryServiceInstance = null;
function getTreasuryService() {
    return (treasuryServiceInstance ??= new TreasuryService());
}
//# sourceMappingURL=TreasuryService.js.map