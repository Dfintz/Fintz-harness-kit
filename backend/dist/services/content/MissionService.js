"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionService = void 0;
const crypto = __importStar(require("node:crypto"));
const data_source_1 = require("../../data-source");
const ExternalCatalogRecord_1 = require("../../models/ExternalCatalogRecord");
const Mission_1 = require("../../models/Mission");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const WORKFLOW_PHASE_TAGS = {
    dispatch: 'workflow:dispatch:completed',
    quartermaster: 'workflow:quartermaster:completed',
    execution: 'workflow:execution:completed',
    after_action: 'workflow:after-action:completed',
};
const WORKFLOW_STATUS_TRANSITIONS = {
    dispatch: { from: Mission_1.MissionStatus.DRAFT, to: Mission_1.MissionStatus.PLANNED },
    quartermaster: { from: Mission_1.MissionStatus.PLANNED, to: Mission_1.MissionStatus.BRIEFED },
    execution: { from: Mission_1.MissionStatus.BRIEFED, to: Mission_1.MissionStatus.IN_PROGRESS },
    after_action: {
        from: Mission_1.MissionStatus.IN_PROGRESS,
        to: Mission_1.MissionStatus.COMPLETED,
        setsCompletedAt: true,
    },
};
const WORKFLOW_PHASE_ORDER = [
    'dispatch',
    'quartermaster',
    'execution',
    'after_action',
];
const QUARTERMASTER_COMPLETED_STATUSES = new Set([
    Mission_1.MissionStatus.BRIEFED,
    Mission_1.MissionStatus.IN_PROGRESS,
    Mission_1.MissionStatus.COMPLETED,
    Mission_1.MissionStatus.FAILED,
    Mission_1.MissionStatus.CANCELLED,
]);
const EXECUTION_COMPLETED_STATUSES = new Set([
    Mission_1.MissionStatus.IN_PROGRESS,
    Mission_1.MissionStatus.COMPLETED,
    Mission_1.MissionStatus.FAILED,
    Mission_1.MissionStatus.CANCELLED,
]);
class MissionService {
    _missionRepository;
    _externalCatalogRepository;
    get missionRepository() {
        if (!data_source_1.AppDataSource.isInitialized) {
            throw new apiErrors_1.ServiceUnavailableError('Database not initialized - call initializeDatabase() before using MissionService database operations');
        }
        this._missionRepository ??= data_source_1.AppDataSource.getRepository(Mission_1.Mission);
        return this._missionRepository;
    }
    get externalCatalogRepository() {
        if (!data_source_1.AppDataSource.isInitialized) {
            throw new apiErrors_1.ServiceUnavailableError('Database not initialized - call initializeDatabase() before using MissionService database operations');
        }
        this._externalCatalogRepository ??= data_source_1.AppDataSource.getRepository(ExternalCatalogRecord_1.ExternalCatalogRecord);
        return this._externalCatalogRepository;
    }
    async searchScmdbMissionCards(filters = {}) {
        const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);
        const query = this.externalCatalogRepository
            .createQueryBuilder('record')
            .where('record.source = :source', { source: ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB })
            .andWhere('record.recordType = :recordType', {
            recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.CONTRACT,
        })
            .andWhere('record.isActive = :isActive', { isActive: true });
        if (filters.category) {
            query.andWhere('record.category = :category', { category: filters.category });
        }
        if (filters.search) {
            const search = `%${filters.search}%`;
            query.andWhere('(record.displayName ILIKE :search OR record.category ILIKE :search)', {
                search,
            });
        }
        const records = await query.orderBy('record.updatedAt', 'DESC').take(limit).getMany();
        return records.map(record => this.mapScmdbRecordToMissionCard(record));
    }
    async getScmdbAvailableFilters() {
        try {
            const result = await this.externalCatalogRepository
                .createQueryBuilder('record')
                .select('record.category', 'category')
                .addSelect('COUNT(*)', 'count')
                .where('record.source = :source', { source: ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB })
                .andWhere('record.recordType = :recordType', {
                recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.CONTRACT,
            })
                .andWhere('record.isActive = :isActive', { isActive: true })
                .andWhere('record.category IS NOT NULL')
                .groupBy('record.category')
                .orderBy('record.category', 'ASC')
                .getRawMany();
            const categories = result.map(row => ({
                name: row.category || 'unknown',
                count: parseInt(row.count, 10) || 0,
            }));
            return { categories };
        }
        catch (error) {
            logger_1.logger.error('MissionService.getScmdbAvailableFilters: Failed to fetch filter categories', error instanceof Error ? error : new Error(String(error)));
            return { categories: [] };
        }
    }
    async importScmdbMissionByUrl(organizationId, createdBy, url, input = {}) {
        const { parseScmdbMissionUrl } = await Promise.resolve().then(() => __importStar(require('../../utils/scmdbUtils')));
        const missionId = parseScmdbMissionUrl(url);
        if (!missionId) {
            throw new apiErrors_1.ValidationError('Invalid SCMDB URL or mission ID. Expected format: https://scmdb.net/contracts/{ID} or bare ID');
        }
        const existing = await this.missionRepository
            .createQueryBuilder('mission')
            .where('mission.organizationId = :organizationId', { organizationId })
            .andWhere('mission.tags LIKE :importTag', { importTag: `scmdb:${missionId}` })
            .getOne();
        if (existing) {
            throw new apiErrors_1.ConflictError(`Mission ${missionId} is already imported in this organization`);
        }
        const record = await this.externalCatalogRepository
            .createQueryBuilder('record')
            .where('record.source = :source', { source: ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB })
            .andWhere('record.recordType = :recordType', {
            recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.CONTRACT,
        })
            .andWhere('record.isActive = :isActive', { isActive: true })
            .andWhere('record.externalId = :externalId', { externalId: missionId })
            .getOne();
        if (!record) {
            throw new apiErrors_1.ValidationError(`Mission ${missionId} not found in SCMDB cache`);
        }
        const mission = this.missionRepository.create(this.mapScmdbRecordToMissionCreatePayload(record, organizationId, createdBy, {
            externalId: missionId,
            ...input,
        }));
        try {
            const saved = await this.missionRepository.save(mission);
            return saved;
        }
        catch (error) {
            if (error instanceof Error &&
                'code' in error &&
                error.code === '23505') {
                throw new apiErrors_1.ConflictError(`Mission ${missionId} is already imported in this organization`);
            }
            throw error;
        }
    }
    async importScmdbMissions(organizationId, createdBy, inputs) {
        const sanitizedInputs = inputs
            .map(item => ({
            externalId: item.externalId.trim(),
            priority: item.priority,
            startDate: item.startDate,
            endDate: item.endDate,
            notes: item.notes,
        }))
            .filter(item => item.externalId.length > 0);
        if (sanitizedInputs.length === 0) {
            throw new apiErrors_1.ValidationError('At least one SCMDB mission externalId is required');
        }
        const uniqueExternalIds = [...new Set(sanitizedInputs.map(item => item.externalId))];
        const records = await this.externalCatalogRepository
            .createQueryBuilder('record')
            .where('record.source = :source', { source: ExternalCatalogRecord_1.ExternalCatalogSource.SCMDB })
            .andWhere('record.recordType = :recordType', {
            recordType: ExternalCatalogRecord_1.ExternalCatalogRecordType.CONTRACT,
        })
            .andWhere('record.isActive = :isActive', { isActive: true })
            .andWhere('record.externalId IN (:...externalIds)', { externalIds: uniqueExternalIds })
            .getMany();
        const recordByExternalId = new Map(records.map(record => [record.externalId, record]));
        const existingMissions = await this.missionRepository
            .createQueryBuilder('mission')
            .where('mission.organizationId = :organizationId', { organizationId })
            .andWhere('mission.tags LIKE :importTagPrefix', { importTagPrefix: 'scmdb:%' })
            .getMany();
        const importedExternalIdSet = new Set(existingMissions
            .flatMap(mission => mission.tags ?? [])
            .filter(tag => tag.startsWith('scmdb:'))
            .map(tag => tag.slice('scmdb:'.length)));
        const imported = [];
        const skipped = [];
        for (const input of sanitizedInputs) {
            const record = recordByExternalId.get(input.externalId);
            if (!record) {
                skipped.push({ externalId: input.externalId, reason: 'not-found-in-scmdb-cache' });
                continue;
            }
            if (importedExternalIdSet.has(input.externalId)) {
                skipped.push({ externalId: input.externalId, reason: 'already-imported' });
                continue;
            }
            const mission = this.missionRepository.create(this.mapScmdbRecordToMissionCreatePayload(record, organizationId, createdBy, input));
            const saved = await this.missionRepository.save(mission);
            imported.push(saved);
            importedExternalIdSet.add(input.externalId);
        }
        return { imported, skipped };
    }
    mapScmdbRecordToMissionCard(record) {
        const payload = record.payload;
        const title = this.readPayloadString(payload, ['title', 'name', 'displayName']) ??
            record.displayName ??
            `SCMDB Contract ${record.externalId}`;
        return {
            externalId: record.externalId,
            title,
            category: this.readPayloadString(payload, ['category', 'missionType']) ?? record.category ?? 'custom',
            description: this.readPayloadString(payload, ['description', 'summary']),
            location: this.readPayloadString(payload, ['location', 'planet', 'system']),
            difficultyHint: this.readPayloadString(payload, ['difficulty', 'riskLevel']),
            rewardHint: this.readPayloadString(payload, ['reward', 'payout']),
            tags: this.collectMissionTags(record),
            payload,
        };
    }
    mapScmdbRecordToMissionCreatePayload(record, organizationId, createdBy, input) {
        const card = this.mapScmdbRecordToMissionCard(record);
        const sourceUrl = `https://scmdb.net/en/contracts/${record.externalId}`;
        const traceLine = `SCMDB Source: ${sourceUrl}`;
        const noteLines = [traceLine, input.notes?.trim()].filter((value) => Boolean(value && value.length > 0));
        return {
            organizationId,
            createdBy,
            title: card.title,
            description: card.description,
            missionType: this.mapCategoryToMissionType(card.category),
            difficulty: this.mapDifficulty(card.difficultyHint),
            priority: input.priority ?? Mission_1.MissionPriority.NORMAL,
            location: card.location,
            reward: card.rewardHint,
            startDate: input.startDate,
            endDate: input.endDate,
            notes: noteLines.join('\n'),
            status: Mission_1.MissionStatus.DRAFT,
            tags: [...card.tags, `scmdb:${record.externalId}`, `source:${sourceUrl}`],
            sourceReference: `scmdb:${record.externalId}`,
        };
    }
    mapCategoryToMissionType(categoryRaw) {
        const category = categoryRaw.toLowerCase();
        if (category.includes('combat') || category.includes('bounty')) {
            return Mission_1.MissionType.COMBAT;
        }
        if (category.includes('mining')) {
            return Mission_1.MissionType.MINING;
        }
        if (category.includes('trade') || category.includes('cargo')) {
            return Mission_1.MissionType.TRADING;
        }
        if (category.includes('explor')) {
            return Mission_1.MissionType.EXPLORATION;
        }
        if (category.includes('escort')) {
            return Mission_1.MissionType.ESCORT;
        }
        if (category.includes('rescue') || category.includes('medical')) {
            return Mission_1.MissionType.RESCUE;
        }
        if (category.includes('recon')) {
            return Mission_1.MissionType.RECONNAISSANCE;
        }
        if (category.includes('salvage')) {
            return Mission_1.MissionType.SALVAGE;
        }
        if (category.includes('logistics')) {
            return Mission_1.MissionType.LOGISTICS;
        }
        return Mission_1.MissionType.CUSTOM;
    }
    mapDifficulty(difficultyRaw) {
        if (!difficultyRaw) {
            return Mission_1.MissionDifficulty.MEDIUM;
        }
        const normalized = difficultyRaw.toLowerCase();
        if (normalized.includes('trivial') || normalized.includes('very easy')) {
            return Mission_1.MissionDifficulty.TRIVIAL;
        }
        if (normalized.includes('easy') || normalized.includes('low')) {
            return Mission_1.MissionDifficulty.EASY;
        }
        if (normalized.includes('hard') || normalized.includes('high')) {
            return Mission_1.MissionDifficulty.HARD;
        }
        if (normalized.includes('extreme')) {
            return Mission_1.MissionDifficulty.EXTREME;
        }
        return Mission_1.MissionDifficulty.MEDIUM;
    }
    readPayloadString(payload, keys) {
        for (const key of keys) {
            const value = payload[key];
            if (typeof value === 'string' && value.trim().length > 0) {
                return value.trim();
            }
        }
        return undefined;
    }
    collectMissionTags(record) {
        const tags = new Set();
        if (record.category) {
            tags.add(record.category.toLowerCase().replace(/\s+/g, '-'));
        }
        const payloadTags = record.payload.tags;
        if (Array.isArray(payloadTags)) {
            for (const tag of payloadTags) {
                if (typeof tag === 'string' && tag.trim().length > 0) {
                    tags.add(tag.trim().toLowerCase().replace(/\s+/g, '-'));
                }
            }
        }
        tags.add('scmdb-import');
        return [...tags];
    }
    async createMission(organizationId, missionData) {
        const mission = this.missionRepository.create({
            ...missionData,
            organizationId,
            status: Mission_1.MissionStatus.DRAFT,
        });
        return this.missionRepository.save(mission);
    }
    async getMissionById(id, organizationId) {
        return this.missionRepository.findOne({
            where: { id, organizationId },
            relations: ['fleet'],
        });
    }
    async getAllMissions(organizationId, paginationOptions, filters) {
        const page = paginationOptions.page || 1;
        const limit = paginationOptions.limit || 10;
        const skip = (page - 1) * limit;
        const sortBy = paginationOptions.sortBy || 'createdAt';
        const sortOrder = paginationOptions.sortOrder || 'DESC';
        const query = this.missionRepository.createQueryBuilder('mission');
        query.andWhere('mission.organizationId = :organizationId', { organizationId });
        query.andWhere('mission.deletedAt IS NULL');
        query.leftJoinAndSelect('mission.fleet', 'fleet');
        if (filters?.status) {
            query.andWhere('mission.status = :status', { status: filters.status });
        }
        if (filters?.missionType) {
            query.andWhere('mission.missionType = :missionType', {
                missionType: filters.missionType,
            });
        }
        if (filters?.difficulty) {
            query.andWhere('mission.difficulty = :difficulty', {
                difficulty: filters.difficulty,
            });
        }
        if (filters?.priority) {
            query.andWhere('mission.priority = :priority', {
                priority: filters.priority,
            });
        }
        if (filters?.createdBy) {
            query.andWhere('mission.createdBy = :createdBy', {
                createdBy: filters.createdBy,
            });
        }
        if (filters?.assignedTo) {
            query.andWhere('mission.assignedTo = :assignedTo', {
                assignedTo: filters.assignedTo,
            });
        }
        if (filters?.fleetId) {
            query.andWhere('mission.fleetId = :fleetId', {
                fleetId: filters.fleetId,
            });
        }
        if (filters?.tags && filters.tags.length > 0) {
            filters.tags.forEach((tag, idx) => {
                query.andWhere(`mission.tags LIKE :tag${idx}`, {
                    [`tag${idx}`]: `%${tag}%`,
                });
            });
        }
        if (filters?.search) {
            query.andWhere('(mission.title ILIKE :search OR mission.description ILIKE :search OR mission.location ILIKE :search)', { search: `%${filters.search}%` });
        }
        if (filters?.startDateFrom) {
            query.andWhere('mission.startDate >= :startDateFrom', {
                startDateFrom: filters.startDateFrom,
            });
        }
        if (filters?.startDateTo) {
            query.andWhere('mission.startDate <= :startDateTo', {
                startDateTo: filters.startDateTo,
            });
        }
        const [data, total] = await query
            .orderBy(`mission.${sortBy}`, sortOrder)
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
    async updateMission(id, organizationId, updates) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        if (updates.status && updates.status !== mission.status) {
            if (!mission.canTransitionTo(updates.status)) {
                throw new apiErrors_1.ValidationError(`Invalid status transition from '${mission.status}' to '${updates.status}'`);
            }
            if (updates.status === Mission_1.MissionStatus.COMPLETED || updates.status === Mission_1.MissionStatus.FAILED) {
                updates.completedAt = new Date();
            }
        }
        Object.assign(mission, updates, { updatedAt: new Date() });
        return this.missionRepository.save(mission);
    }
    async deleteMission(id, organizationId, deletedBy) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return false;
        }
        mission.deletedAt = new Date();
        mission.deletedBy = deletedBy;
        await this.missionRepository.save(mission);
        return true;
    }
    async getWorkflow(id, organizationId) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        const phases = this.buildWorkflowPhases(mission);
        const completedPhases = phases.filter(phase => phase.completed).length;
        return {
            missionId: mission.id,
            missionStatus: mission.status,
            completedPhases,
            totalPhases: phases.length,
            completionPercent: Math.round((completedPhases / phases.length) * 100),
            phases,
        };
    }
    async advanceWorkflowPhase(id, organizationId, phase, notes) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        const phaseState = this.buildWorkflowPhases(mission).find(p => p.phase === phase);
        if (!phaseState) {
            throw new apiErrors_1.ValidationError(`Unknown workflow phase '${phase}'`);
        }
        if (phaseState.blockers.length > 0) {
            throw new apiErrors_1.ValidationError(`Cannot advance '${phase}' phase: ${phaseState.blockers.join('; ')}`);
        }
        this.markWorkflowPhaseComplete(mission, phase);
        this.applyWorkflowStatusTransition(mission, phase);
        this.appendWorkflowNotes(mission, phase, notes);
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async transitionStatus(id, organizationId, newStatus) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        if (!mission.canTransitionTo(newStatus)) {
            throw new apiErrors_1.ValidationError(`Invalid status transition from '${mission.status}' to '${newStatus}'`);
        }
        mission.status = newStatus;
        if (newStatus === Mission_1.MissionStatus.COMPLETED || newStatus === Mission_1.MissionStatus.FAILED) {
            mission.completedAt = new Date();
        }
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async completeMission(id, organizationId, outcome) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        if (!mission.canTransitionTo(outcome.status)) {
            throw new apiErrors_1.ValidationError(`Cannot transition from '${mission.status}' to '${outcome.status}'`);
        }
        mission.status = outcome.status;
        mission.completedAt = new Date();
        if (outcome.notes) {
            mission.notes = outcome.notes;
        }
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async assignMission(id, organizationId, userId, role = 'leader') {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        mission.assignedTo = userId;
        const participants = mission.participants || [];
        const existingIdx = participants.findIndex(p => p.userId === userId);
        if (existingIdx >= 0) {
            participants[existingIdx].role = role;
            participants[existingIdx].status = 'confirmed';
        }
        else {
            participants.push({
                userId,
                role,
                joinedAt: new Date().toISOString(),
                status: 'confirmed',
            });
        }
        mission.participants = participants;
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async addParticipant(id, organizationId, userId, role = 'member') {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        const participants = mission.participants || [];
        if (participants.some(p => p.userId === userId)) {
            throw new apiErrors_1.ConflictError('User is already a participant in this mission');
        }
        participants.push({
            userId,
            role,
            joinedAt: new Date().toISOString(),
            status: 'pending',
        });
        mission.participants = participants;
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async removeParticipant(id, organizationId, userId) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        const participants = mission.participants || [];
        mission.participants = participants.filter(p => p.userId !== userId);
        if (mission.assignedTo === userId) {
            mission.assignedTo = undefined;
        }
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async getParticipants(id, organizationId) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        return mission.participants || [];
    }
    async addObjective(id, organizationId, objective) {
        const mission = await this.getMissionById(id, organizationId);
        if (!mission) {
            return null;
        }
        const objectives = mission.objectives || [];
        const maxOrder = objectives.reduce((max, o) => Math.max(max, o.order), 0);
        objectives.push({
            id: crypto.randomUUID(),
            title: objective.title,
            description: objective.description,
            completed: false,
            optional: objective.optional ?? false,
            order: maxOrder + 1,
        });
        mission.objectives = objectives;
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async updateObjective(missionId, organizationId, objectiveId, updates) {
        const mission = await this.getMissionById(missionId, organizationId);
        if (!mission?.objectives) {
            return null;
        }
        const objIdx = mission.objectives.findIndex(o => o.id === objectiveId);
        if (objIdx === -1) {
            return null;
        }
        mission.objectives[objIdx] = {
            ...mission.objectives[objIdx],
            ...updates,
        };
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async removeObjective(missionId, organizationId, objectiveId) {
        const mission = await this.getMissionById(missionId, organizationId);
        if (!mission?.objectives) {
            return null;
        }
        mission.objectives = mission.objectives.filter(o => o.id !== objectiveId);
        mission.updatedAt = new Date();
        return this.missionRepository.save(mission);
    }
    async getMissionsByFleet(fleetId, organizationId) {
        return this.missionRepository.find({
            where: { fleetId, organizationId, deletedAt: undefined },
            order: { createdAt: 'DESC' },
            relations: ['fleet'],
        });
    }
    async getActiveMissions(organizationId) {
        return this.missionRepository.find({
            where: [
                { organizationId, status: Mission_1.MissionStatus.PLANNED, deletedAt: undefined },
                { organizationId, status: Mission_1.MissionStatus.BRIEFED, deletedAt: undefined },
                { organizationId, status: Mission_1.MissionStatus.IN_PROGRESS, deletedAt: undefined },
            ],
            order: { priority: 'DESC', startDate: 'ASC' },
            relations: ['fleet'],
        });
    }
    async getTemplates(organizationId) {
        return this.missionRepository.find({
            where: {
                organizationId,
                status: Mission_1.MissionStatus.DRAFT,
                assignedTo: undefined,
                deletedAt: undefined,
            },
            order: { createdAt: 'DESC' },
        });
    }
    hasWorkflowTag(mission, phase) {
        return (mission.tags ?? []).includes(WORKFLOW_PHASE_TAGS[phase]);
    }
    markWorkflowPhaseComplete(mission, phase) {
        const currentTags = mission.tags ?? [];
        const completionTag = WORKFLOW_PHASE_TAGS[phase];
        if (!currentTags.includes(completionTag)) {
            mission.tags = [...currentTags, completionTag];
        }
    }
    applyWorkflowStatusTransition(mission, phase) {
        const transition = WORKFLOW_STATUS_TRANSITIONS[phase];
        if (!transition) {
            return;
        }
        if (mission.status !== transition.from || !mission.canTransitionTo(transition.to)) {
            return;
        }
        mission.status = transition.to;
        if (transition.setsCompletedAt) {
            mission.completedAt = new Date();
        }
    }
    appendWorkflowNotes(mission, phase, notes) {
        const trimmedNotes = notes?.trim();
        if (!trimmedNotes) {
            return;
        }
        const noteHeader = `\n[Workflow:${phase}] ${trimmedNotes}`;
        mission.notes = `${mission.notes ?? ''}${noteHeader}`.trim();
    }
    isTerminalMissionStatus(status) {
        return [Mission_1.MissionStatus.COMPLETED, Mission_1.MissionStatus.FAILED, Mission_1.MissionStatus.CANCELLED].includes(status);
    }
    getDispatchBlockers(mission) {
        const blockers = [];
        if (!mission.assignedTo && (!mission.participants || mission.participants.length === 0)) {
            blockers.push('Assign a mission lead or add at least one participant.');
        }
        return blockers;
    }
    getQuartermasterBlockers(mission) {
        const blockers = [];
        if (!mission.objectives || mission.objectives.length === 0) {
            blockers.push('Define at least one mission objective.');
        }
        if (!mission.location) {
            blockers.push('Set a mission location for deployment planning.');
        }
        return blockers;
    }
    getExecutionBlockers(mission) {
        const blockers = [];
        if (!this.hasWorkflowTag(mission, 'dispatch')) {
            blockers.push('Complete dispatch phase first.');
        }
        if (!this.hasWorkflowTag(mission, 'quartermaster')) {
            blockers.push('Complete quartermaster phase first.');
        }
        return blockers;
    }
    getAfterActionBlockers(mission, isTerminalStatus) {
        const blockers = [];
        if (mission.status !== Mission_1.MissionStatus.IN_PROGRESS && !isTerminalStatus) {
            blockers.push('Mission must be in progress or finished before after-action.');
        }
        return blockers;
    }
    isDispatchCompleted(mission) {
        return this.hasWorkflowTag(mission, 'dispatch') || mission.status !== Mission_1.MissionStatus.DRAFT;
    }
    isQuartermasterCompleted(mission) {
        return (this.hasWorkflowTag(mission, 'quartermaster') ||
            QUARTERMASTER_COMPLETED_STATUSES.has(mission.status));
    }
    isExecutionCompleted(mission) {
        return (this.hasWorkflowTag(mission, 'execution') || EXECUTION_COMPLETED_STATUSES.has(mission.status));
    }
    buildWorkflowPhases(mission) {
        const dispatchBlockers = this.getDispatchBlockers(mission);
        const quartermasterBlockers = this.getQuartermasterBlockers(mission);
        const executionBlockers = this.getExecutionBlockers(mission);
        const isTerminalStatus = this.isTerminalMissionStatus(mission.status);
        const afterActionBlockers = this.getAfterActionBlockers(mission, isTerminalStatus);
        const phaseMap = {
            dispatch: {
                phase: 'dispatch',
                title: 'Dispatch',
                description: 'Confirm command lead, participants, and mission activation.',
                completed: this.isDispatchCompleted(mission),
                blockers: dispatchBlockers,
                suggestedStatus: Mission_1.MissionStatus.PLANNED,
                nextActions: [
                    'Assign a mission lead',
                    'Confirm participant roster',
                    'Move mission to planned',
                ],
            },
            quartermaster: {
                phase: 'quartermaster',
                title: 'Quartermaster',
                description: 'Validate objectives, location, and mission prep before briefing.',
                completed: this.isQuartermasterCompleted(mission),
                blockers: quartermasterBlockers,
                suggestedStatus: Mission_1.MissionStatus.BRIEFED,
                nextActions: [
                    'Finalize objectives',
                    'Confirm logistics and location',
                    'Mark mission briefed',
                ],
            },
            execution: {
                phase: 'execution',
                title: 'Execution',
                description: 'Launch mission execution and track active operation.',
                completed: this.isExecutionCompleted(mission),
                blockers: executionBlockers,
                suggestedStatus: Mission_1.MissionStatus.IN_PROGRESS,
                nextActions: [
                    'Start mission run',
                    'Monitor objective progress',
                    'Capture in-mission updates',
                ],
            },
            after_action: {
                phase: 'after_action',
                title: 'After Action',
                description: 'Capture outcomes, lessons learned, and finalize mission result.',
                completed: this.hasWorkflowTag(mission, 'after_action') || isTerminalStatus,
                blockers: afterActionBlockers,
                suggestedStatus: Mission_1.MissionStatus.COMPLETED,
                nextActions: [
                    'Record mission notes',
                    'Close with completed/failed outcome',
                    'Capture follow-up actions',
                ],
            },
        };
        return WORKFLOW_PHASE_ORDER.map(phase => phaseMap[phase]);
    }
}
exports.MissionService = MissionService;
//# sourceMappingURL=MissionService.js.map