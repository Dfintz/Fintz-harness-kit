/**
 * Activity Template Service
 * Handles activity templates for quick activity creation.
 * Extends TenantService for multi-tenant CRUD, caching, soft-delete, and sharing.
 */

import { FindOptionsWhere, ILike } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  Activity,
  ActivityStatus,
  ActivityType,
  type ResourceRequirement,
  type RoleRequirement,
} from '../../models/Activity';
import {
  ActivityTemplate,
  ActivityTemplateCategory,
  type ActivityTemplateData,
} from '../../models/ActivityTemplate';
import { logger } from '../../utils/logger';
import { TenantService } from '../base/TenantService';

export interface CreateTemplateDTO {
  name: string;
  description?: string;
  activityType: ActivityType;
  category?: ActivityTemplateCategory;
  templateData?: ActivityTemplateData;
  isPublic?: boolean;
  tags?: string[];
}

export interface UpdateTemplateDTO {
  name?: string;
  description?: string;
  activityType?: ActivityType;
  category?: ActivityTemplateCategory;
  templateData?: ActivityTemplateData;
  isPublic?: boolean;
  isActive?: boolean;
  tags?: string[];
}

export interface TemplateQueryFilters {
  category?: ActivityTemplateCategory;
  activityType?: ActivityType;
  isPublic?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ApplyTemplateDTO {
  title: string;
  scheduledStartTime: string;
  estimatedDuration?: number;
  maxParticipants?: number;
  overrides?: Record<string, unknown>;
}

export class ActivityTemplateService extends TenantService<ActivityTemplate> {
  constructor() {
    super(AppDataSource.getRepository(ActivityTemplate), {
      enableCache: true,
      cacheTTL: 600,
      cacheCheckPeriod: 120,
    });
  }

  /**
   * Get all activity templates for an organization with optional filters
   */
  async getTemplates(organizationId: string, filters: TemplateQueryFilters = {}) {
    const { category, activityType, isPublic, search, page = 1, limit = 20 } = filters;

    const where: FindOptionsWhere<ActivityTemplate> = {
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
      where.name = ILike(`%${search}%`);
    }

    return this.findAllPaginated(
      organizationId,
      {
        page,
        limit,
        sortBy: 'updatedAt',
        sortOrder: 'DESC',
      },
      where
    );
  }

  /**
   * List activity templates (alias for getTemplates)
   */
  async listTemplates(organizationId: string, filters: TemplateQueryFilters = {}) {
    return this.getTemplates(organizationId, filters);
  }

  /**
   * Get a specific activity template by ID (alias)
   */
  async getTemplateById(organizationId: string, templateId: string, _userId: string) {
    return this.getTemplate(organizationId, templateId);
  }

  /**
   * Get a specific activity template
   */
  async getTemplate(organizationId: string, templateId: string) {
    const template = await this.findById(organizationId, templateId);
    if (!template) {
      return null;
    }
    return template;
  }

  /**
   * Create a new activity template
   */
  async createTemplate(
    organizationId: string,
    dto: CreateTemplateDTO,
    userId: string,
    userName?: string
  ) {
    const template = await this.create(organizationId, {
      name: dto.name,
      description: dto.description,
      activityType: dto.activityType,
      category: dto.category ?? ActivityTemplateCategory.CUSTOM,
      templateData: dto.templateData ?? {},
      isPublic: dto.isPublic ?? false,
      tags: dto.tags,
      createdBy: userId,
      createdByName: userName,
    });

    logger.info('Activity template created', {
      templateId: template.id,
      organizationId,
      createdBy: userId,
    });

    return template;
  }

  /**
   * Update an activity template
   */
  async updateTemplate(
    organizationId: string,
    templateId: string,
    dto: UpdateTemplateDTO,
    _userId: string
  ) {
    const existing = await this.findById(organizationId, templateId);
    if (!existing) {
      return null;
    }

    const updates: Partial<ActivityTemplate> = {};
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

    logger.info('Activity template updated', {
      templateId,
      organizationId,
    });

    return updated;
  }

  /**
   * Delete an activity template (soft delete)
   */
  async deleteTemplate(organizationId: string, templateId: string, _userId: string) {
    const existing = await this.findById(organizationId, templateId);
    if (!existing) {
      return false;
    }

    await this.softDelete(organizationId, templateId);

    logger.info('Activity template deleted', {
      templateId,
      organizationId,
    });

    return true;
  }

  /**
   * Clone an activity template
   */
  async cloneTemplate(
    organizationId: string,
    templateId: string,
    userId: string,
    userName?: string
  ) {
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

    logger.info('Activity template cloned', {
      sourceId: templateId,
      cloneId: clone.id,
      organizationId,
    });

    return clone;
  }

  /**
   * Create an activity from a template
   */
  async createActivityFromTemplate(
    organizationId: string,
    templateId: string,
    dto: ApplyTemplateDTO,
    userId: string,
    userName?: string
  ) {
    const template = await this.findById(organizationId, templateId);
    if (!template) {
      return null;
    }

    const td = template.templateData;
    const overrides = dto.overrides ?? {};

    const activityRepo = AppDataSource.getRepository(Activity);
    const activity = activityRepo.create({
      title: dto.title,
      description: (overrides.description as string) ?? td.description ?? '',
      activityType: td.activityType ?? template.activityType,
      status: ActivityStatus.DRAFT,
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
      })) as RoleRequirement[],
      resourceRequirements: (td.resourceRequirements ?? []).map(r => ({
        type: 'equipment' as const,
        name: r.resource,
        quantity: r.quantity,
        provided: 0,
      })) as ResourceRequirement[],
    });

    const saved = await activityRepo.save(activity);

    // Increment usage count
    template.incrementUsage();
    await this.repository.save(template);

    logger.info('Activity created from template', {
      activityId: saved.id,
      templateId,
      organizationId,
    });

    return saved;
  }

  /**
   * Get available template categories
   */
  getCategories(): Array<{ value: string; label: string }> {
    return Object.values(ActivityTemplateCategory).map(value => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
    }));
  }
}

