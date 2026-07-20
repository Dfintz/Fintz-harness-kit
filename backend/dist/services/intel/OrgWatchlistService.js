"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrgWatchlistService = void 0;
const typeorm_1 = require("typeorm");
const database_1 = require("../../config/database");
const OrgWatchlistEntry_1 = require("../../models/OrgWatchlistEntry");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
class OrgWatchlistService {
    repo;
    constructor() {
        this.repo = database_1.AppDataSource.getRepository(OrgWatchlistEntry_1.OrgWatchlistEntry);
    }
    async createEntry(organizationId, officerId, dto) {
        const data = {
            organizationId,
            addedBy: officerId,
            rsiHandle: dto.rsiHandle.trim().toUpperCase(),
            citizenName: dto.citizenName.trim(),
            reason: dto.reason,
            threatLevel: dto.threatLevel,
            notes: dto.notes,
        };
        const entry = this.repo.create(data);
        try {
            const saved = await this.repo.save(entry);
            return this.toSummary(saved);
        }
        catch (error) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === '23505') {
                throw new apiErrors_1.ConflictError(`A watchlist entry for RSI handle "${data.rsiHandle}" already exists in this organization`);
            }
            throw error;
        }
    }
    async getEntryById(organizationId, entryId) {
        const entry = await this.repo.findOne({
            where: { id: entryId, organizationId },
        });
        return entry ? this.toSummary(entry) : null;
    }
    async listEntries(organizationId, query) {
        const page = query?.page ?? 1;
        const pageSize = Math.min(query?.pageSize ?? 25, 100);
        const sortBy = query?.sortBy ?? 'createdAt';
        const sortOrder = query?.sortOrder ?? 'DESC';
        try {
            const qb = this.repo
                .createQueryBuilder('w')
                .where('w.organizationId = :organizationId', { organizationId });
            if (query?.reasons && query.reasons.length > 0) {
                qb.andWhere('w.reason IN (:...reasons)', { reasons: query.reasons });
            }
            if (query?.threatLevels && query.threatLevels.length > 0) {
                qb.andWhere('w.threatLevel IN (:...threatLevels)', {
                    threatLevels: query.threatLevels,
                });
            }
            if (query?.search) {
                qb.andWhere('(LOWER(w.rsiHandle) LIKE :search OR LOWER(w.citizenName) LIKE :search)', {
                    search: `%${query.search.toLowerCase()}%`,
                });
            }
            const ALLOWED_SORT = new Set([
                'createdAt',
                'updatedAt',
                'citizenName',
                'rsiHandle',
                'threatLevel',
                'reason',
            ]);
            const safeSortBy = ALLOWED_SORT.has(sortBy) ? sortBy : 'createdAt';
            qb.orderBy(`w.${safeSortBy}`, sortOrder)
                .skip((page - 1) * pageSize)
                .take(pageSize);
            const [entries, total] = await qb.getManyAndCount();
            return {
                data: entries.map(e => this.toSummary(e)),
                total,
                page,
                pageSize,
            };
        }
        catch (err) {
            logger_1.logger.error('OrgWatchlistService.listEntries failed', {
                error: err instanceof Error ? err.message : String(err),
                stack: err instanceof Error ? err.stack : undefined,
                organizationId,
            });
            return { data: [], total: 0, page, pageSize };
        }
    }
    async updateEntry(organizationId, entryId, dto) {
        const entry = await this.repo.findOne({
            where: { id: entryId, organizationId },
        });
        if (!entry) {
            throw new apiErrors_1.NotFoundError('Watchlist entry not found');
        }
        if (dto.reason !== undefined) {
            entry.reason = dto.reason;
        }
        if (dto.threatLevel !== undefined) {
            entry.threatLevel = dto.threatLevel;
        }
        if (dto.notes !== undefined) {
            entry.notes = dto.notes;
        }
        if (dto.citizenName !== undefined) {
            entry.citizenName = dto.citizenName.trim();
        }
        const saved = await this.repo.save(entry);
        return this.toSummary(saved);
    }
    async deleteEntry(organizationId, entryId) {
        const result = await this.repo.delete({
            id: entryId,
            organizationId,
        });
        return (result.affected ?? 0) > 0;
    }
    async crossReference(organizationId, rsiHandles) {
        if (rsiHandles.length === 0) {
            return [];
        }
        const normalised = rsiHandles.map(s => s.trim().toUpperCase());
        const entries = await this.repo.find({
            where: {
                organizationId,
                rsiHandle: (0, typeorm_1.In)(normalised),
            },
        });
        return entries.map(entry => ({
            rsiHandle: entry.rsiHandle,
            entry: this.toSummary(entry),
        }));
    }
    async findByHandle(organizationId, rsiHandle) {
        const entry = await this.repo.findOne({
            where: {
                organizationId,
                rsiHandle: rsiHandle.trim().toUpperCase(),
            },
        });
        return entry ? this.toSummary(entry) : null;
    }
    toSummary(entry) {
        return {
            id: entry.id,
            organizationId: entry.organizationId,
            rsiHandle: entry.rsiHandle,
            citizenName: entry.citizenName,
            reason: entry.reason,
            threatLevel: entry.threatLevel,
            notes: entry.notes,
            addedBy: entry.addedBy,
            createdAt: entry.createdAt.toISOString(),
            updatedAt: entry.updatedAt.toISOString(),
        };
    }
}
exports.OrgWatchlistService = OrgWatchlistService;
//# sourceMappingURL=OrgWatchlistService.js.map