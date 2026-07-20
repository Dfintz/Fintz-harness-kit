"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityTemplateService = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityTemplate_1 = require("../../models/ActivityTemplate");
const logger_1 = require("../../utils/logger");
const TenantService_1 = require("../base/TenantService");
class ActivityTemplateService extends TenantService_1.TenantService {
    constructor() {
        super(data_source_1.AppDataSource.getRepository(ActivityTemplate_1.ActivityTemplate), {
            enableCache: true,
            cacheTTL: 600,
            cacheCheckPeriod: 120,
        });
    }
    async getTemplates(organizationId, filters = {}) {
        const { category, activityType, isPublic, search, page = 1, limit = 20 } = filters;
        const where = {
            organizationId,
            isActive: true,
        };
        if (category) {
            where.category = category;
        }
        if (activityType) {
            where.activityType = activityType;
        }
        if (typeof isPublic === 'boolean') {
            where.isPublic = isPublic;
        }
        if (search) {
            where.name = (0, typeorm_1.ILike)(`%${search}%`);
        }
        return this.findAllPaginated(organizationId, {
            page,
            limit,
            sortBy: 'updatedAt',
            sortOrder: 'DESC',
        }, where);
    }
    async listTemplates(organizationId, filters = {}) {
        return this.getTemplates(organizationId, filters);
    }
    async getTemplateById(organizationId, templateId, _userId) {
        return this.getTemplate(organizationId, templateId);
    }
    async getTemplate(organizationId, templateId) {
        const template = await this.findById(organizationId, templateId);
        if (!template) {
            return null;
        }
        return template;
    }
    async createTemplate(organizationId, dto, userId, userName) {
        const template = await this.create(organizationId, {
            name: dto.name,
            description: dto.description,
            activityType: dto.activityType,
            category: dto.category ?? ActivityTemplate_1.ActivityTemplateCategory.CUSTOM,
            templateData: dto.templateData ?? {},
            isPublic: dto.isPublic ?? false,
            tags: dto.tags,
            createdBy: userId,
            createdByName: userName,
        });
        logger_1.logger.info('Activity template created', {
            templateId: template.id,
            organizationId,
            createdBy: userId,
        });
        return template;
    }
    async updateTemplate(organizationId, templateId, dto, _userId) {
        const existing = await this.findById(organizationId, templateId);
        if (!existing) {
            return null;
        }
        const updates = {};
        if (dto.name !== undefined) {
            updates.name = dto.name;
        }
        if (dto.description !== undefined) {
            updates.description = dto.description;
        }
        if (dto.activityType !== undefined) {
            updates.activityType = dto.activityType;
        }
        if (dto.category !== undefined) {
            updates.category = dto.category;
        }
        if (dto.templateData !== undefined) {
            updates.templateData = dto.templateData;
        }
        if (dto.isPublic !== undefined) {
            updates.isPublic = dto.isPublic;
        }
        if (dto.isActive !== undefined) {
            updates.isActive = dto.isActive;
        }
        if (dto.tags !== undefined) {
            updates.tags = dto.tags;
        }
        const updated = await this.update(organizationId, templateId, updates);
        logger_1.logger.info('Activity template updated', {
            templateId,
            organizationId,
        });
        return updated;
    }
    async deleteTemplate(organizationId, templateId, _userId) {
        const existing = await this.findById(organizationId, templateId);
        if (!existing) {
            return false;
        }
        await this.softDelete(organizationId, templateId);
        logger_1.logger.info('Activity template deleted', {
            templateId,
            organizationId,
        });
        return true;
    }
    async cloneTemplate(organizationId, templateId, userId, userName) {
        const source = await this.findById(organizationId, templateId);
        if (!source) {
            return null;
        }
        const clone = await this.create(organizationId, {
            name: `${source.name} (Copy)`,
            description: source.description,
            activityType: source.activityType,
            category: source.category,
            templateData: { ...source.templateData },
            isPublic: false,
            tags: source.tags ? [...source.tags] : undefined,
            createdBy: userId,
            createdByName: userName,
        });
        logger_1.logger.info('Activity template cloned', {
            sourceId: templateId,
            cloneId: clone.id,
            organizationId,
        });
        return clone;
    }
    async createActivityFromTemplate(organizationId, templateId, dto, userId, userName) {
        const template = await this.findById(organizationId, templateId);
        if (!template) {
            return null;
        }
        const td = template.templateData;
        const overrides = dto.overrides ?? {};
        const activityRepo = data_source_1.AppDataSource.getRepository(Activity_1.Activity);
        const activity = activityRepo.create({
            title: dto.title,
            description: overrides.description ?? td.description ?? '',
            activityType: td.activityType ?? template.activityType,
            status: Activity_1.ActivityStatus.DRAFT,
            visibility: td.visibility,
            organizationId,
            creatorId: userId,
            creatorName: userName ?? '',
            scheduledStartDate: new Date(dto.scheduledStartTime),
            estimatedDuration: dto.estimatedDuration ?? td.estimatedDuration,
            maxParticipants: dto.maxParticipants ?? td.maxParticipants,
            minParticipants: td.minParticipants,
            systemLocation: td.locationSystem,
            location: td.locationDetails,
            tags: td.tags,
            roleRequirements: (td.roleRequirements ?? []).map(r => ({
                role: r.role,
                min: r.count,
                max: r.count,
                filled: 0,
                required: r.required,
            })),
            resourceRequirements: (td.resourceRequirements ?? []).map(r => ({
                type: 'equipment',
                name: r.resource,
                quantity: r.quantity,
                provided: 0,
            })),
        });
        const saved = await activityRepo.save(activity);
        template.incrementUsage();
        await this.repository.save(template);
        logger_1.logger.info('Activity created from template', {
            activityId: saved.id,
            templateId,
            organizationId,
        });
        return saved;
    }
    getCategories() {
        return Object.values(ActivityTemplate_1.ActivityTemplateCategory).map(value => ({
            value,
            label: value.charAt(0).toUpperCase() + value.slice(1),
        }));
    }
}
exports.ActivityTemplateService = ActivityTemplateService;
//# sourceMappingURL=activityTemplate.service.js.map