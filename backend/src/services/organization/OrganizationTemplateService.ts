import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationPermission } from '../../models/OrganizationPermission';
import {
  OrganizationTemplate,
  TemplateCategory,
  TemplateStructure,
  TemplateVisibility,
} from '../../models/OrganizationTemplate';

export class OrganizationTemplateService {
  private templateRepository: Repository<OrganizationTemplate>;
  private organizationRepository: Repository<Organization>;
  private membershipRepository: Repository<OrganizationMembership>;
  private permissionRepository: Repository<OrganizationPermission>;

  constructor() {
    this.templateRepository = AppDataSource.getRepository(OrganizationTemplate);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.permissionRepository = AppDataSource.getRepository(OrganizationPermission);
  }

  /**
   * Create a new organization template
   */
  async createTemplate(
    data: {
      name: string;
      description: string;
      category: TemplateCategory;
      visibility: TemplateVisibility;
      structure: TemplateStructure;
      defaultSettings?: Record<string, unknown>;
      applicationConfig?: {
        allowApplications: boolean;
        requireApproval: boolean;
        autoAssignRole?: string;
        welcomeMessage?: string;
      };
      tags?: string[];
    },
    creatorId: string
  ): Promise<OrganizationTemplate> {
    const template = this.templateRepository.create({
      ...data,
      creatorId,
      isPublic:
        data.visibility === TemplateVisibility.PUBLIC ||
        data.visibility === TemplateVisibility.MARKETPLACE,
      usageCount: 0,
      averageRating: 0,
      ratingCount: 0,
    });

    // Validate template structure
    const validation = template.validateStructure();
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    const savedTemplate = await this.templateRepository.save(template);
    return savedTemplate;
  }

  /**
   * Apply a template to create or restructure an organization
   */
  async applyTemplate(
    templateId: string,
    options: {
      organizationId?: string; // If provided, restructure existing org
      organizationName?: string; // If creating new org
      organizationDescription?: string;
      ownerId: string;
      customizations?: {
        skipNodes?: string[]; // Node IDs to skip
        overrides?: Record<string, unknown>; // Override specific settings
      };
    }
  ): Promise<Organization> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId },
      relations: ['creator'],
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Increment usage count
    template.usageCount++;
    template.lastUsedAt = new Date();
    await this.templateRepository.save(template);

    let organization: Organization;

    if (options.organizationId) {
      // Restructure existing organization
      const foundOrg = await this.organizationRepository.findOne({
        where: { id: options.organizationId },
        relations: ['memberships', 'permissions'],
      });

      if (!foundOrg) {
        throw new Error('Organization not found');
      }

      organization = foundOrg;

      // Clear existing structure (keep memberships)
      organization.structure = null;
    } else {
      // Create new organization
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
      } as Record<string, unknown>);
      organization = Array.isArray(orgData) ? orgData[0] : orgData;

      organization = await this.organizationRepository.save(organization);

      // Add owner as member
      const ownerMembership = this.membershipRepository.create({
        organizationId: organization.id,
        userId: options.ownerId,
        role: 'owner',
        permissions: ['manage_org', 'manage_members', 'manage_permissions', 'view_analytics'],
      } as Record<string, unknown>);
      await this.membershipRepository.save(ownerMembership);
    }

    // Apply template structure
    const structure = this.applyCustomizations(template.structure, options.customizations);

    organization.structure = structure;
    await this.organizationRepository.save(organization);

    // Create default roles and permissions
    await this.createDefaultRolesAndPermissions(organization, template);

    return organization;
  }

  /**
   * Apply customizations to template structure
   */
  private applyCustomizations(
    structure: TemplateStructure,
    customizations?: {
      skipNodes?: string[];
      overrides?: Record<string, unknown>;
    }
  ): TemplateStructure {
    if (!customizations) {
      return structure;
    }

    const result = { ...structure };

    // Apply overrides
    if (customizations.overrides) {
      Object.assign(result, customizations.overrides);
    }

    // Filter out skipped nodes
    if (customizations.skipNodes && result.children) {
      const nodesToSkip = customizations.skipNodes;
      result.children = result.children.filter(
        child =>
          !nodesToSkip.includes(
            String((child as unknown as Record<string, string>).id || child.name)
          )
      );

      // Recursively apply to children
      result.children = result.children.map(child =>
        this.applyCustomizations(child, customizations)
      );
    }

    return result;
  }

  /**
   * Create default roles and permissions from template
   */
  private async createDefaultRolesAndPermissions(
    organization: Organization,
    template: OrganizationTemplate
  ): Promise<void> {
    // Create permissions from default roles
    for (const role of template.defaultRoles) {
      for (const permission of role.permissions as unknown as Record<string, unknown>[]) {
        const perm = this.permissionRepository.create({
          organizationId: organization.id,
          resource: permission.resource,
          actions: [permission.action],
          isActive: true,
        } as Record<string, unknown>);
        await this.permissionRepository.save(perm);
      }
    }

    // Create permissions from default permissions
    for (const permission of template.defaultPermissions) {
      const perm = this.permissionRepository.create({
        organizationId: organization.id,
        resource: permission.resource,
        actions: permission.actions,
        isActive: true,
      } as Record<string, unknown>);
      await this.permissionRepository.save(perm);
    }
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(
    category: TemplateCategory,
    visibility?: TemplateVisibility
  ): Promise<OrganizationTemplate[]> {
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

  /**
   * Search templates in marketplace
   */
  async searchMarketplace(query: {
    search?: string;
    category?: TemplateCategory;
    tags?: string[];
    minRating?: number;
    sortBy?: 'usage' | 'rating' | 'recent' | 'name';
    sortOrder?: 'ASC' | 'DESC';
    limit?: number;
    offset?: number;
  }): Promise<{ templates: OrganizationTemplate[]; total: number }> {
    const queryBuilder = this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.creator', 'creator')
      .where('template.visibility = :visibility', { visibility: TemplateVisibility.MARKETPLACE });

    // Search filter
    if (query.search) {
      queryBuilder.andWhere('(template.name ILIKE :search OR template.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    // Category filter
    if (query.category) {
      queryBuilder.andWhere('template.category = :category', { category: query.category });
    }

    // Tags filter
    if (query.tags && query.tags.length > 0) {
      queryBuilder.andWhere('template.tags && :tags', { tags: query.tags });
    }

    // Rating filter
    if (query.minRating !== undefined) {
      queryBuilder.andWhere('template.averageRating >= :minRating', { minRating: query.minRating });
    }

    // Sorting
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

    // Get total count
    const total = await queryBuilder.getCount();

    // Pagination
    if (query.limit) {
      queryBuilder.limit(query.limit);
    }
    if (query.offset) {
      queryBuilder.offset(query.offset);
    }

    const templates = await queryBuilder.getMany();

    return { templates, total };
  }

  /**
   * Fork a template to create a customized version
   */
  async forkTemplate(
    templateId: string,
    userId: string,
    customizations?: {
      name?: string;
      description?: string;
      visibility?: TemplateVisibility;
      structure?: TemplateStructure;
    }
  ): Promise<OrganizationTemplate> {
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

  /**
   * Rate a template
   */
  async rateTemplate(
    templateId: string,
    userId: string,
    rating: number
  ): Promise<OrganizationTemplate> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const template = await this.templateRepository.findOne({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    // Store rating in metadata (in a real app, you'd have a separate ratings table)
    if (!template.metadata) {
      template.metadata = {};
    }
    const metadata = template.metadata;
    if (!metadata.ratings) {
      metadata.ratings = {};
    }

    const ratings = metadata.ratings as Record<string, number>;
    const previousRating = ratings[userId];
    ratings[userId] = rating;

    // Update average rating
    if (previousRating === undefined) {
      // New rating
      const totalRating = template.averageRating * template.ratingCount + rating;
      template.ratingCount++;
      template.averageRating = totalRating / template.ratingCount;
    } else {
      // Update existing rating
      const totalRating = template.averageRating * template.ratingCount - previousRating + rating;
      template.averageRating = totalRating / template.ratingCount;
    }

    return this.templateRepository.save(template);
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    userId: string,
    updates: {
      name?: string;
      description?: string;
      structure?: TemplateStructure;
      defaultSettings?: Record<string, unknown>;
      applicationConfig?: Record<string, unknown>;
      tags?: string[];
      visibility?: TemplateVisibility;
    }
  ): Promise<OrganizationTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.creatorId !== userId) {
      throw new Error('Only template creator can update it');
    }

    // Update version if structure changed
    if (
      updates.structure &&
      JSON.stringify(updates.structure) !== JSON.stringify(template.structure)
    ) {
      template.version = (parseFloat(template.version) + 0.1).toFixed(1);
    }

    Object.assign(template, updates);

    // Validate if structure changed
    if (updates.structure) {
      const validation = template.validateStructure();
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }
    }

    return this.templateRepository.save(template);
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
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

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<OrganizationTemplate | null> {
    return this.templateRepository.findOne({
      where: { id: templateId },
      relations: ['creator', 'forkedFrom'],
    });
  }

  /**
   * Get templates created by user
   */
  async getTemplatesByUser(userId: string): Promise<OrganizationTemplate[]> {
    return this.templateRepository.find({
      where: { creatorId: userId },
      relations: ['forkedFrom'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get popular templates
   */
  async getPopularTemplates(limit: number = 10): Promise<OrganizationTemplate[]> {
    return this.templateRepository.find({
      where: { visibility: TemplateVisibility.MARKETPLACE },
      relations: ['creator'],
      order: { usageCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get top rated templates
   */
  async getTopRatedTemplates(limit: number = 10): Promise<OrganizationTemplate[]> {
    return this.templateRepository.find({
      where: { visibility: TemplateVisibility.MARKETPLACE },
      relations: ['creator'],
      order: { averageRating: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get recently used templates
   */
  async getRecentlyUsedTemplates(limit: number = 10): Promise<OrganizationTemplate[]> {
    return this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.creator', 'creator')
      .where('template.lastUsedAt IS NOT NULL')
      .orderBy('template.lastUsedAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  /**
   * Export template to JSON
   */
  async exportTemplate(templateId: string): Promise<unknown> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }
    return template.export();
  }

  /**
   * Import template from JSON
   */
  async importTemplate(
    data: Record<string, unknown>,
    userId: string
  ): Promise<OrganizationTemplate> {
    const template = this.templateRepository.create({
      name: data.name,
      description: data.description,
      category: data.category,
      visibility: TemplateVisibility.PRIVATE, // Always import as private
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
    } as Record<string, unknown>);

    // Validate structure
    const validation = template.validateStructure();
    if (!validation.valid) {
      throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
    }

    return this.templateRepository.save(template);
  }
}

