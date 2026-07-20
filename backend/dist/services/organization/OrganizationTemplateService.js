"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationTemplateService = void 0;
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationPermission_1 = require("../../models/OrganizationPermission");
const OrganizationTemplate_1 = require("../../models/OrganizationTemplate");
class OrganizationTemplateService {
    templateRepository;
    organizationRepository;
    membershipRepository;
    permissionRepository;
    constructor() {
        this.templateRepository = data_source_1.AppDataSource.getRepository(OrganizationTemplate_1.OrganizationTemplate);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.permissionRepository = data_source_1.AppDataSource.getRepository(OrganizationPermission_1.OrganizationPermission);
    }
    async createTemplate(data, creatorId) {
        const template = this.templateRepository.create({
            ...data,
            creatorId,
            isPublic: data.visibility === OrganizationTemplate_1.TemplateVisibility.PUBLIC ||
                data.visibility === OrganizationTemplate_1.TemplateVisibility.MARKETPLACE,
            usageCount: 0,
            averageRating: 0,
            ratingCount: 0,
        });
        const validation = template.validateStructure();
        if (!validation.valid) {
            throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }
        const savedTemplate = await this.templateRepository.save(template);
        return savedTemplate;
    }
    async applyTemplate(templateId, options) {
        const template = await this.templateRepository.findOne({
            where: { id: templateId },
            relations: ['creator'],
        });
        if (!template) {
            throw new Error('Template not found');
        }
        template.usageCount++;
        template.lastUsedAt = new Date();
        await this.templateRepository.save(template);
        let organization;
        if (options.organizationId) {
            const foundOrg = await this.organizationRepository.findOne({
                where: { id: options.organizationId },
                relations: ['memberships', 'permissions'],
            });
            if (!foundOrg) {
                throw new Error('Organization not found');
            }
            organization = foundOrg;
            organization.structure = null;
        }
        else {
            if (!options.organizationName) {
                throw new Error('Organization name required when creating new organization');
            }
            const orgData = this.organizationRepository.create({
                id: options.organizationName.toLowerCase().replace(/\s+/g, '-'),
                name: options.organizationName,
                description: options.organizationDescription || template.description || undefined,
                ownerId: options.ownerId,
                members: [options.ownerId],
                settings: { ...template.defaultSettings },
                metadata: template.applicationConfig
                    ? {
                        allowApplications: template.applicationConfig.allowApplications,
                        requireApproval: template.applicationConfig.requireApproval,
                        autoAssignRole: template.applicationConfig.autoAssignRole,
                        welcomeMessage: template.applicationConfig.welcomeMessage,
                    }
                    : undefined,
            });
            organization = Array.isArray(orgData) ? orgData[0] : orgData;
            organization = await this.organizationRepository.save(organization);
            const ownerMembership = this.membershipRepository.create({
                organizationId: organization.id,
                userId: options.ownerId,
                role: 'owner',
                permissions: ['manage_org', 'manage_members', 'manage_permissions', 'view_analytics'],
            });
            await this.membershipRepository.save(ownerMembership);
        }
        const structure = this.applyCustomizations(template.structure, options.customizations);
        organization.structure = structure;
        await this.organizationRepository.save(organization);
        await this.createDefaultRolesAndPermissions(organization, template);
        return organization;
    }
    applyCustomizations(structure, customizations) {
        if (!customizations) {
            return structure;
        }
        const result = { ...structure };
        if (customizations.overrides) {
            Object.assign(result, customizations.overrides);
        }
        if (customizations.skipNodes && result.children) {
            const nodesToSkip = customizations.skipNodes;
            result.children = result.children.filter(child => !nodesToSkip.includes(String(child.id || child.name)));
            result.children = result.children.map(child => this.applyCustomizations(child, customizations));
        }
        return result;
    }
    async createDefaultRolesAndPermissions(organization, template) {
        for (const role of template.defaultRoles) {
            for (const permission of role.permissions) {
                const perm = this.permissionRepository.create({
                    organizationId: organization.id,
                    resource: permission.resource,
                    actions: [permission.action],
                    isActive: true,
                });
                await this.permissionRepository.save(perm);
            }
        }
        for (const permission of template.defaultPermissions) {
            const perm = this.permissionRepository.create({
                organizationId: organization.id,
                resource: permission.resource,
                actions: permission.actions,
                isActive: true,
            });
            await this.permissionRepository.save(perm);
        }
    }
    async getTemplatesByCategory(category, visibility) {
        const queryBuilder = this.templateRepository
            .createQueryBuilder('template')
            .leftJoinAndSelect('template.creator', 'creator')
            .where('template.category = :category', { category });
        if (visibility) {
            queryBuilder.andWhere('template.visibility = :visibility', { visibility });
        }
        queryBuilder.orderBy('template.usageCount', 'DESC');
        return queryBuilder.getMany();
    }
    async searchMarketplace(query) {
        const queryBuilder = this.templateRepository
            .createQueryBuilder('template')
            .leftJoinAndSelect('template.creator', 'creator')
            .where('template.visibility = :visibility', { visibility: OrganizationTemplate_1.TemplateVisibility.MARKETPLACE });
        if (query.search) {
            queryBuilder.andWhere('(template.name ILIKE :search OR template.description ILIKE :search)', {
                search: `%${query.search}%`,
            });
        }
        if (query.category) {
            queryBuilder.andWhere('template.category = :category', { category: query.category });
        }
        if (query.tags && query.tags.length > 0) {
            queryBuilder.andWhere('template.tags && :tags', { tags: query.tags });
        }
        if (query.minRating !== undefined) {
            queryBuilder.andWhere('template.averageRating >= :minRating', { minRating: query.minRating });
        }
        const sortBy = query.sortBy || 'usage';
        const sortOrder = query.sortOrder || 'DESC';
        switch (sortBy) {
            case 'usage':
                queryBuilder.orderBy('template.usageCount', sortOrder);
                break;
            case 'rating':
                queryBuilder.orderBy('template.averageRating', sortOrder);
                break;
            case 'recent':
                queryBuilder.orderBy('template.createdAt', sortOrder);
                break;
            case 'name':
                queryBuilder.orderBy('template.name', sortOrder);
                break;
        }
        const total = await queryBuilder.getCount();
        if (query.limit) {
            queryBuilder.limit(query.limit);
        }
        if (query.offset) {
            queryBuilder.offset(query.offset);
        }
        const templates = await queryBuilder.getMany();
        return { templates, total };
    }
    async forkTemplate(templateId, userId, customizations) {
        const original = await this.templateRepository.findOne({
            where: { id: templateId },
        });
        if (!original) {
            throw new Error('Template not found');
        }
        const forkedData = original.fork(customizations?.name || `${original.name} (Fork)`, userId);
        const forked = this.templateRepository.create({
            ...forkedData,
            ...(customizations || {}),
        });
        return this.templateRepository.save(forked);
    }
    async rateTemplate(templateId, userId, rating) {
        if (rating < 1 || rating > 5) {
            throw new Error('Rating must be between 1 and 5');
        }
        const template = await this.templateRepository.findOne({
            where: { id: templateId },
        });
        if (!template) {
            throw new Error('Template not found');
        }
        if (!template.metadata) {
            template.metadata = {};
        }
        const metadata = template.metadata;
        if (!metadata.ratings) {
            metadata.ratings = {};
        }
        const ratings = metadata.ratings;
        const previousRating = ratings[userId];
        ratings[userId] = rating;
        if (previousRating === undefined) {
            const totalRating = template.averageRating * template.ratingCount + rating;
            template.ratingCount++;
            template.averageRating = totalRating / template.ratingCount;
        }
        else {
            const totalRating = template.averageRating * template.ratingCount - previousRating + rating;
            template.averageRating = totalRating / template.ratingCount;
        }
        return this.templateRepository.save(template);
    }
    async updateTemplate(templateId, userId, updates) {
        const template = await this.templateRepository.findOne({
            where: { id: templateId },
        });
        if (!template) {
            throw new Error('Template not found');
        }
        if (template.creatorId !== userId) {
            throw new Error('Only template creator can update it');
        }
        if (updates.structure &&
            JSON.stringify(updates.structure) !== JSON.stringify(template.structure)) {
            template.version = (parseFloat(template.version) + 0.1).toFixed(1);
        }
        Object.assign(template, updates);
        if (updates.structure) {
            const validation = template.validateStructure();
            if (!validation.valid) {
                throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
            }
        }
        return this.templateRepository.save(template);
    }
    async deleteTemplate(templateId, userId) {
        const template = await this.templateRepository.findOne({
            where: { id: templateId },
        });
        if (!template) {
            throw new Error('Template not found');
        }
        if (template.creatorId !== userId) {
            throw new Error('Only template creator can delete it');
        }
        await this.templateRepository.remove(template);
    }
    async getTemplateById(templateId) {
        return this.templateRepository.findOne({
            where: { id: templateId },
            relations: ['creator', 'forkedFrom'],
        });
    }
    async getTemplatesByUser(userId) {
        return this.templateRepository.find({
            where: { creatorId: userId },
            relations: ['forkedFrom'],
            order: { createdAt: 'DESC' },
        });
    }
    async getPopularTemplates(limit = 10) {
        return this.templateRepository.find({
            where: { visibility: OrganizationTemplate_1.TemplateVisibility.MARKETPLACE },
            relations: ['creator'],
            order: { usageCount: 'DESC' },
            take: limit,
        });
    }
    async getTopRatedTemplates(limit = 10) {
        return this.templateRepository.find({
            where: { visibility: OrganizationTemplate_1.TemplateVisibility.MARKETPLACE },
            relations: ['creator'],
            order: { averageRating: 'DESC' },
            take: limit,
        });
    }
    async getRecentlyUsedTemplates(limit = 10) {
        return this.templateRepository
            .createQueryBuilder('template')
            .leftJoinAndSelect('template.creator', 'creator')
            .where('template.lastUsedAt IS NOT NULL')
            .orderBy('template.lastUsedAt', 'DESC')
            .limit(limit)
            .getMany();
    }
    async exportTemplate(templateId) {
        const template = await this.getTemplateById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }
        return template.export();
    }
    async importTemplate(data, userId) {
        const template = this.templateRepository.create({
            name: data.name,
            description: data.description,
            category: data.category,
            visibility: OrganizationTemplate_1.TemplateVisibility.PRIVATE,
            structure: data.structure,
            defaultRoles: data.defaultRoles,
            defaultPermissions: data.defaultPermissions,
            defaultSettings: data.defaultSettings,
            applicationConfig: data.applicationConfig,
            tags: data.tags,
            creatorId: userId,
            version: '1.0',
            usageCount: 0,
            averageRating: 0,
            ratingCount: 0,
        });
        const validation = template.validateStructure();
        if (!validation.valid) {
            throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
        }
        return this.templateRepository.save(template);
    }
}
exports.OrganizationTemplateService = OrganizationTemplateService;
//# sourceMappingURL=OrganizationTemplateService.js.map