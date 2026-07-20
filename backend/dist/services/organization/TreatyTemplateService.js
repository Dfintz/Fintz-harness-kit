"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatyTemplateService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const TreatyTemplate_1 = require("../../models/TreatyTemplate");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
class TreatyTemplateService {
    repository = data_source_1.AppDataSource.getRepository(TreatyTemplate_1.TreatyTemplate);
    async getTemplates(organizationId, filters, pagination) {
        logger_1.logger.info('TreatyTemplateService.getTemplates', { organizationId });
        const queryBuilder = this.repository
            .createQueryBuilder('t')
            .where('(t.isBuiltIn = true OR t.organizationId = :orgId)', { orgId: organizationId });
        if (filters?.category) {
            queryBuilder.andWhere('t.category = :category', { category: filters.category });
        }
        if (filters?.scope) {
            queryBuilder.andWhere('(t.scope = :scope OR t.scope = :both)', {
                scope: filters.scope,
                both: 'both',
            });
        }
        if (filters?.search) {
            queryBuilder.andWhere('(t.name ILIKE :search OR t.description ILIKE :search)', {
                search: `%${filters.search}%`,
            });
        }
        queryBuilder.orderBy('t.isBuiltIn', 'DESC').addOrderBy('t.name', 'ASC');
        const page = pagination?.page ?? 1;
        const limit = pagination?.limit ?? 50;
        const skip = (page - 1) * limit;
        const [items, total] = await queryBuilder.skip(skip).take(limit).getManyAndCount();
        return {
            data: items,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1,
            },
        };
    }
    async getTemplateById(organizationId, templateId) {
        logger_1.logger.info('TreatyTemplateService.getTemplateById', { organizationId, templateId });
        const template = await this.repository.findOne({
            where: [
                { id: templateId, isBuiltIn: true },
                { id: templateId, organizationId },
            ],
        });
        if (!template) {
            throw new apiErrors_1.NotFoundError('Treaty template');
        }
        return template;
    }
    async createTemplate(organizationId, data) {
        logger_1.logger.info('TreatyTemplateService.createTemplate', {
            organizationId,
            name: data.name,
        });
        const existing = await this.repository.findOne({
            where: { name: data.name, organizationId },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A treaty template with this name already exists');
        }
        const clauses = data.clauses.map((c, index) => ({
            ...c,
            id: node_crypto_1.default.randomUUID(),
            sortOrder: c.sortOrder ?? index + 1,
        }));
        const template = this.repository.create({
            id: node_crypto_1.default.randomUUID(),
            name: data.name,
            description: data.description,
            category: data.category,
            scope: data.scope,
            clauses,
            isBuiltIn: false,
            organizationId,
            isPublished: data.isPublished ?? false,
            version: 1,
            tags: data.tags ?? [],
        });
        return this.repository.save(template);
    }
    async updateTemplate(organizationId, templateId, data) {
        logger_1.logger.info('TreatyTemplateService.updateTemplate', { organizationId, templateId });
        const template = await this.repository.findOne({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new apiErrors_1.NotFoundError('Treaty template');
        }
        if (template.isBuiltIn) {
            throw new apiErrors_1.ForbiddenError('Built-in templates cannot be modified');
        }
        if (data.name !== undefined) {
            const existing = await this.repository.findOne({
                where: { name: data.name, organizationId },
            });
            if (existing && existing.id !== templateId) {
                throw new apiErrors_1.ConflictError('A treaty template with this name already exists');
            }
            template.name = data.name;
        }
        if (data.description !== undefined) {
            template.description = data.description;
        }
        if (data.category !== undefined) {
            template.category = data.category;
        }
        if (data.scope !== undefined) {
            template.scope = data.scope;
        }
        if (data.isPublished !== undefined) {
            template.isPublished = data.isPublished;
        }
        if (data.tags !== undefined) {
            template.tags = data.tags;
        }
        if (data.clauses !== undefined) {
            template.clauses = data.clauses.map((c, index) => ({
                ...c,
                id: node_crypto_1.default.randomUUID(),
                sortOrder: c.sortOrder ?? index + 1,
            }));
            template.version += 1;
        }
        return this.repository.save(template);
    }
    async deleteTemplate(organizationId, templateId) {
        logger_1.logger.info('TreatyTemplateService.deleteTemplate', { organizationId, templateId });
        const template = await this.repository.findOne({
            where: { id: templateId, organizationId },
        });
        if (!template) {
            throw new apiErrors_1.NotFoundError('Treaty template');
        }
        if (template.isBuiltIn) {
            throw new apiErrors_1.ForbiddenError('Built-in templates cannot be deleted');
        }
        await this.repository.remove(template);
    }
    async instantiateTemplate(organizationId, data) {
        const template = await this.getTemplateById(organizationId, data.templateId);
        const excludeSet = new Set(data.excludeClauses ?? []);
        const overrides = data.clauseOverrides ?? {};
        const terms = template.clauses
            .filter(clause => {
            if (excludeSet.has(clause.title)) {
                if (clause.isRequired) {
                    throw new apiErrors_1.ValidationError(`Cannot exclude required clause: "${clause.title}"`);
                }
                return false;
            }
            return true;
        })
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(clause => ({
            term: clause.title,
            description: overrides[clause.title] ?? clause.text,
        }));
        if (data.additionalClauses) {
            for (const custom of data.additionalClauses) {
                terms.push({
                    term: custom.title,
                    description: custom.text,
                });
            }
        }
        return terms;
    }
    async getBuiltInTemplates() {
        return this.repository.find({
            where: { isBuiltIn: true },
            order: { category: 'ASC', name: 'ASC' },
        });
    }
}
exports.TreatyTemplateService = TreatyTemplateService;
//# sourceMappingURL=TreatyTemplateService.js.map