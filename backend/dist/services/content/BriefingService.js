"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BriefingService = void 0;
const node_crypto_1 = require("node:crypto");
const data_source_1 = require("../../data-source");
const Briefing_1 = require("../../models/Briefing");
const starcomms_1 = require("../communication/starcomms");
class BriefingService {
    _briefingRepository;
    starCommsContextSyncService = new starcomms_1.StarCommsContextSyncService();
    get briefingRepository() {
        if (!data_source_1.AppDataSource.isInitialized) {
            throw new Error('Database not initialized - call initializeDatabase() before using BriefingService database operations');
        }
        this._briefingRepository ??= data_source_1.AppDataSource.getRepository(Briefing_1.Briefing);
        return this._briefingRepository;
    }
    async createBriefing(organizationId, briefingData) {
        const briefing = this.briefingRepository.create({
            ...briefingData,
            organizationId,
        });
        const saved = await this.briefingRepository.save(briefing);
        this.starCommsContextSyncService
            .syncBriefingContext({
            organizationId,
            briefingId: saved.id,
            title: saved.title,
            classification: saved.classification,
            status: saved.status,
            missionId: saved.missionId,
            operationIds: saved.operationIds,
        })
            .catch(() => {
        });
        return saved;
    }
    async getBriefingById(id, organizationId) {
        return this.briefingRepository.findOne({
            where: { id, organizationId },
        });
    }
    async getAllBriefings(organizationId, paginationOptions, filters) {
        const page = paginationOptions.page ?? 1;
        const limit = paginationOptions.limit ?? 10;
        const skip = (page - 1) * limit;
        const ALLOWED_SORT_COLUMNS = [
            'createdAt',
            'updatedAt',
            'title',
            'status',
            'classification',
            'version',
        ];
        const rawSortBy = paginationOptions.sortBy ?? 'createdAt';
        const sortBy = ALLOWED_SORT_COLUMNS.includes(rawSortBy)
            ? rawSortBy
            : 'createdAt';
        const sortOrder = paginationOptions.sortOrder ?? 'DESC';
        const query = this.briefingRepository.createQueryBuilder('briefing');
        query.andWhere('briefing.organizationId = :organizationId', { organizationId });
        if (filters?.creatorId) {
            query.andWhere('briefing.creatorId = :creatorId', {
                creatorId: filters.creatorId,
            });
        }
        if (filters?.missionId) {
            query.andWhere('briefing.missionId = :missionId', {
                missionId: filters.missionId,
            });
        }
        if (filters?.status) {
            query.andWhere('briefing.status = :status', { status: filters.status });
        }
        if (filters?.classification) {
            query.andWhere('briefing.classification = :classification', {
                classification: filters.classification,
            });
        }
        if (filters?.operationId) {
            query.andWhere('briefing."operationIds" LIKE :operationId', {
                operationId: `%"${filters.operationId}"%`,
            });
        }
        if (filters?.tags && filters.tags.length > 0) {
            filters.tags.forEach((tag, index) => {
                query.andWhere(`briefing.tags LIKE :tag_${index}`, {
                    [`tag_${index}`]: `%${tag}%`,
                });
            });
        }
        const [data, total] = await query
            .orderBy(`briefing.${sortBy}`, sortOrder)
            .skip(skip)
            .take(limit)
            .getManyAndCount();
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
    async updateBriefing(id, organizationId, updates) {
        const briefing = await this.getBriefingById(id, organizationId);
        if (!briefing) {
            return null;
        }
        Object.assign(briefing, updates, { updatedAt: new Date() });
        const saved = await this.briefingRepository.save(briefing);
        this.starCommsContextSyncService
            .syncBriefingContext({
            organizationId,
            briefingId: saved.id,
            title: saved.title,
            classification: saved.classification,
            status: saved.status,
            missionId: saved.missionId,
            operationIds: saved.operationIds,
        })
            .catch(() => {
        });
        return saved;
    }
    async deleteBriefing(id, organizationId) {
        const briefing = await this.getBriefingById(id, organizationId);
        if (!briefing) {
            return false;
        }
        const result = await this.briefingRepository.delete({ id, organizationId });
        return (result.affected ?? 0) > 0;
    }
    async addElement(briefingId, organizationId, element) {
        const briefing = await this.getBriefingById(briefingId, organizationId);
        if (!briefing) {
            return null;
        }
        const elements = briefing.elements ?? [];
        const newElement = {
            id: (0, node_crypto_1.randomUUID)(),
            type: element.type,
            position: element.position,
            data: element.data,
        };
        elements.push(newElement);
        briefing.elements = elements;
        briefing.updatedAt = new Date();
        return this.briefingRepository.save(briefing);
    }
    async updateElement(briefingId, organizationId, elementId, updates) {
        const briefing = await this.getBriefingById(briefingId, organizationId);
        if (!briefing?.elements) {
            return null;
        }
        const elementIndex = briefing.elements.findIndex(e => e.id === elementId);
        if (elementIndex === -1) {
            return null;
        }
        briefing.elements[elementIndex] = {
            ...briefing.elements[elementIndex],
            ...updates,
        };
        briefing.updatedAt = new Date();
        return this.briefingRepository.save(briefing);
    }
    async deleteElement(briefingId, organizationId, elementId) {
        const briefing = await this.getBriefingById(briefingId, organizationId);
        if (!briefing?.elements) {
            return null;
        }
        briefing.elements = briefing.elements.filter(e => e.id !== elementId);
        briefing.updatedAt = new Date();
        return this.briefingRepository.save(briefing);
    }
    async addParticipant(briefingId, organizationId, userId) {
        const briefing = await this.getBriefingById(briefingId, organizationId);
        if (!briefing) {
            return null;
        }
        const participants = briefing.participants ?? [];
        if (!participants.includes(userId)) {
            participants.push(userId);
            briefing.participants = participants;
            briefing.updatedAt = new Date();
            return this.briefingRepository.save(briefing);
        }
        return briefing;
    }
    async removeParticipant(briefingId, organizationId, userId) {
        const briefing = await this.getBriefingById(briefingId, organizationId);
        if (!briefing) {
            return null;
        }
        const participants = briefing.participants ?? [];
        briefing.participants = participants.filter(id => id !== userId);
        briefing.updatedAt = new Date();
        return this.briefingRepository.save(briefing);
    }
    async updateStatus(briefingId, organizationId, status) {
        return this.updateBriefing(briefingId, organizationId, { status });
    }
    async createVersion(briefingId, organizationId) {
        const originalBriefing = await this.getBriefingById(briefingId, organizationId);
        if (!originalBriefing) {
            return null;
        }
        const newVersion = this.briefingRepository.create({
            ...originalBriefing,
            id: undefined,
            organizationId,
            version: originalBriefing.version + 1,
            createdAt: undefined,
            updatedAt: undefined,
        });
        return this.briefingRepository.save(newVersion);
    }
    async getBriefingsByMission(missionId, organizationId) {
        return this.briefingRepository.find({
            where: { missionId, organizationId },
            order: { version: 'DESC' },
        });
    }
}
exports.BriefingService = BriefingService;
//# sourceMappingURL=BriefingService.js.map