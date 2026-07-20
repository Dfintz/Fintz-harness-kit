"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationIntelService = void 0;
const data_source_1 = require("../../data-source");
const FederationIntelEntry_1 = require("../../models/FederationIntelEntry");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
class FederationIntelService {
    static instance;
    intelRepository;
    ambassadorService;
    constructor() {
        this.intelRepository = data_source_1.AppDataSource.getRepository(FederationIntelEntry_1.FederationIntelEntry);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationIntelService.instance) {
            FederationIntelService.instance = new FederationIntelService();
        }
        return FederationIntelService.instance;
    }
    toData(entity) {
        return {
            id: entity.id,
            federationId: entity.federationId,
            title: entity.title,
            content: entity.content,
            classification: entity.classification,
            status: entity.status,
            submittedBy: entity.submittedBy,
            submittedByName: entity.submittedByName,
            submittedByOrgId: entity.submittedByOrgId,
            approvedBy: entity.approvedBy,
            tags: entity.tags ?? [],
            visibleToTreaties: entity.visibleToTreaties ?? [],
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
        };
    }
    async submitIntel(federationId, userId, data) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'intel', 'Ambassador intel permission required to submit intel');
        if (!data.title?.trim() || data.title.trim().length < 3) {
            throw new apiErrors_1.ValidationError('Intel title must be at least 3 characters');
        }
        if (!data.content?.trim() || data.content.trim().length < 10) {
            throw new apiErrors_1.ValidationError('Intel content must be at least 10 characters');
        }
        const entry = this.intelRepository.create({
            federationId,
            title: data.title.trim(),
            content: data.content.trim(),
            classification: data.classification ?? 'open',
            status: 'pending_review',
            submittedBy: userId,
            submittedByName: data.submittedByName ?? null,
            submittedByOrgId: data.submittedByOrgId ?? null,
            tags: data.tags ?? [],
            visibleToTreaties: data.visibleToTreaties ?? [],
        });
        const saved = await this.intelRepository.save(entry);
        logger_1.logger.info('Federation intel submitted', {
            federationId,
            intelId: saved.id,
            classification: saved.classification,
        });
        return this.toData(saved);
    }
    async listIntel(federationId, userId, filters) {
        await (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'federation intel');
        const where = { federationId };
        if (filters?.classification) {
            where.classification = filters.classification;
        }
        if (filters?.status) {
            where.status = filters.status;
        }
        const entries = await this.intelRepository.find({
            where,
            order: { createdAt: 'DESC' },
            take: 100,
        });
        return entries.map(e => this.toData(e));
    }
    async getIntel(federationId, userId, intelId) {
        await (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'federation intel');
        const entry = await this.intelRepository.findOne({
            where: { id: intelId, federationId },
        });
        if (!entry) {
            throw new apiErrors_1.NotFoundError('Intel entry', intelId);
        }
        return this.toData(entry);
    }
    async approveIntel(federationId, userId, intelId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'intel', 'Ambassador intel permission required to approve intel');
        const entry = await this.intelRepository.findOne({
            where: { id: intelId, federationId },
        });
        if (!entry) {
            throw new apiErrors_1.NotFoundError('Intel entry', intelId);
        }
        if (entry.status !== 'pending_review' && entry.status !== 'draft') {
            throw new apiErrors_1.ValidationError('Only pending or draft intel can be approved');
        }
        entry.status = 'published';
        entry.approvedBy = userId;
        const saved = await this.intelRepository.save(entry);
        logger_1.logger.info('Federation intel approved', { federationId, intelId });
        return this.toData(saved);
    }
    async archiveIntel(federationId, userId, intelId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'intel', 'Ambassador intel permission required to archive intel');
        const entry = await this.intelRepository.findOne({
            where: { id: intelId, federationId },
        });
        if (!entry) {
            throw new apiErrors_1.NotFoundError('Intel entry', intelId);
        }
        entry.status = 'archived';
        const saved = await this.intelRepository.save(entry);
        logger_1.logger.info('Federation intel archived', { federationId, intelId });
        return this.toData(saved);
    }
    async updateIntel(federationId, userId, intelId, data) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'intel', 'Ambassador intel permission required to update intel');
        const entry = await this.intelRepository.findOne({
            where: { id: intelId, federationId },
        });
        if (!entry) {
            throw new apiErrors_1.NotFoundError('Intel entry', intelId);
        }
        if (entry.status === 'archived') {
            throw new apiErrors_1.ValidationError('Archived intel cannot be edited');
        }
        if (data.title !== undefined) {
            entry.title = data.title.trim();
        }
        if (data.content !== undefined) {
            entry.content = data.content.trim();
        }
        if (data.classification !== undefined) {
            entry.classification = data.classification;
        }
        if (data.tags !== undefined) {
            entry.tags = data.tags;
        }
        if (data.visibleToTreaties !== undefined) {
            entry.visibleToTreaties = data.visibleToTreaties;
        }
        const saved = await this.intelRepository.save(entry);
        logger_1.logger.info('Federation intel updated', { federationId, intelId });
        return this.toData(saved);
    }
    async deleteIntel(federationId, userId, intelId) {
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'intel', 'Ambassador intel permission required to delete intel');
        const entry = await this.intelRepository.findOne({
            where: { id: intelId, federationId },
        });
        if (!entry) {
            throw new apiErrors_1.NotFoundError('Intel entry', intelId);
        }
        await this.intelRepository.remove(entry);
        logger_1.logger.info('Federation intel deleted', { federationId, intelId });
    }
}
exports.FederationIntelService = FederationIntelService;
//# sourceMappingURL=FederationIntelService.js.map