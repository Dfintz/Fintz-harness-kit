import crypto from 'node:crypto';

import { AppDataSource } from '../../data-source';
import {
  TreatyClause,
  TreatyTemplate,
  TreatyTemplateCategory,
  TreatyTemplateScope,
} from '../../models/TreatyTemplate';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

/**
 * TreatyTemplateService
 *
 * Manages treaty agreement templates that can be used for both
 * bilateral alliances (AllianceDiplomacy) and multi-org federations.
 *
 * Built-in templates are read-only and available to all orgs.
 * Custom templates belong to an organization and can be published.
 */
export class TreatyTemplateService {
  private readonly repository = AppDataSource.getRepository(TreatyTemplate);

  /**
   * Get all available templates for an organization.
   * Includes built-in templates and the org's own custom templates.
   */
  async getTemplates(
    organizationId: string,
    filters?: {
      category?: TreatyTemplateCategory;
      scope?: TreatyTemplateScope;
      search?: string;
    },
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<TreatyTemplate>> {
    logger.info('TreatyTemplateService.getTemplates', { organizationId });

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

  /**
   * Get a single template by ID.
   */
  async getTemplateById(organizationId: string, templateId: string): Promise<TreatyTemplate> {
    logger.info('TreatyTemplateService.getTemplateById', { organizationId, templateId });

    const template = await this.repository.findOne({
      where: [
        { id: templateId, isBuiltIn: true },
        { id: templateId, organizationId },
      ],
    });

    if (!template) {
      throw new NotFoundError('Treaty template');
    }

    return template;
  }

  /**
   * Create a new custom treaty template.
   */
  async createTemplate(
    organizationId: string,
    data: {
      name: string;
      description: string;
      category: TreatyTemplateCategory;
      scope: TreatyTemplateScope;
      clauses: Array<Omit<TreatyClause, 'id'>>;
      isPublished?: boolean;
      tags?: string[];
    }
  ): Promise<TreatyTemplate> {
    logger.info('TreatyTemplateService.createTemplate', {
      organizationId,
      name: data.name,
    });

    // Check for duplicate name within org
    const existing = await this.repository.findOne({
      where: { name: data.name, organizationId },
    });
    if (existing) {
      throw new ConflictError('A treaty template with this name already exists');
    }

    // Assign IDs and sort orders to clauses
    const clauses: TreatyClause[] = data.clauses.map((c, index) => ({
      ...c,
      id: crypto.randomUUID(),
      sortOrder: c.sortOrder ?? index + 1,
    }));

    const template = this.repository.create({
      id: crypto.randomUUID(),
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

  /**
   * Update an existing custom template.
   * Built-in templates cannot be modified.
   */
  async updateTemplate(
    organizationId: string,
    templateId: string,
    data: {
      name?: string;
      description?: string;
      category?: TreatyTemplateCategory;
      scope?: TreatyTemplateScope;
      clauses?: Array<Omit<TreatyClause, 'id'>>;
      isPublished?: boolean;
      tags?: string[];
    }
  ): Promise<TreatyTemplate> {
    logger.info('TreatyTemplateService.updateTemplate', { organizationId, templateId });

    const template = await this.repository.findOne({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new NotFoundError('Treaty template');
    }

    if (template.isBuiltIn) {
      throw new ForbiddenError('Built-in templates cannot be modified');
    }

    if (data.name !== undefined) {
      // Check for duplicate name
      const existing = await this.repository.findOne({
        where: { name: data.name, organizationId },
      });
      if (existing && existing.id !== templateId) {
        throw new ConflictError('A treaty template with this name already exists');
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
        id: crypto.randomUUID(),
        sortOrder: c.sortOrder ?? index + 1,
      }));
      template.version += 1;
    }

    return this.repository.save(template);
  }

  /**
   * Delete a custom template.
   * Built-in templates cannot be deleted.
   */
  async deleteTemplate(organizationId: string, templateId: string): Promise<void> {
    logger.info('TreatyTemplateService.deleteTemplate', { organizationId, templateId });

    const template = await this.repository.findOne({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      throw new NotFoundError('Treaty template');
    }

    if (template.isBuiltIn) {
      throw new ForbiddenError('Built-in templates cannot be deleted');
    }

    await this.repository.remove(template);
  }

  /**
   * Instantiate a treaty from a template, producing an array of DiplomaticTerm
   * objects suitable for use in an AllianceDiplomacy or FederationTreaty.
   *
   * Supports:
   * - Overriding specific clause text
   * - Excluding optional (non-required) clauses
   * - Adding additional custom clauses
   */
  async instantiateTemplate(
    organizationId: string,
    data: {
      templateId: string;
      clauseOverrides?: Record<string, string>;
      additionalClauses?: Array<{ title: string; text: string }>;
      excludeClauses?: string[];
    }
  ): Promise<Array<{ term: string; description: string }>> {
    const template = await this.getTemplateById(organizationId, data.templateId);

    const excludeSet = new Set(data.excludeClauses ?? []);
    const overrides = data.clauseOverrides ?? {};

    // Filter and transform clauses
    const terms = template.clauses
      .filter(clause => {
        if (excludeSet.has(clause.title)) {
          if (clause.isRequired) {
            throw new ValidationError(`Cannot exclude required clause: "${clause.title}"`);
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

    // Add custom clauses
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

  /**
   * Get all built-in templates (for seeding or reference).
   */
  async getBuiltInTemplates(): Promise<TreatyTemplate[]> {
    return this.repository.find({
      where: { isBuiltIn: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }
}

