import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../../data-source';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { Permission } from '../../../models/Permission';
import {
  PermissionAuditEntry,
  PermissionTemplate,
  PermissionTemplateItem,
  PermissionTemplateType,
  PermissionUsageReport,
  PermissionUsageStats,
} from '../../../types';
import { AuditEventType, AuditLogEntry, logAuditEvent } from '../../../utils/auditLogger';
import { logger } from '../../../utils/logger';

import { PermissionManagerService } from './PermissionManagerService';

export class PermissionTemplateService {
  private permissionManager: PermissionManagerService;
  private permissionRepository = AppDataSource.getRepository(Permission);
  private userOrgRepository = AppDataSource.getRepository(OrganizationMembership);
  private templates: Map<string, PermissionTemplate> = new Map();
  private auditLog: PermissionAuditEntry[] = [];

  constructor() {
    this.permissionManager = new PermissionManagerService();
    this.initializeSystemTemplates();
  }

  /**
   * Initialize system-wide permission templates
   */
  private initializeSystemTemplates(): void {
    const systemTemplates: PermissionTemplate[] = [
      {
        id: 'system-admin',
        name: 'Administrator',
        type: PermissionTemplateType.ADMIN,
        description: 'Full administrative access to all organization resources',
        permissions: [
          { resource: 'fleet', action: 'manage', description: 'Full fleet management' },
          { resource: 'events', action: 'manage', description: 'Full event management' },
          { resource: 'members', action: 'manage', description: 'Member management' },
          { resource: 'permissions', action: 'manage', description: 'Permission management' },
          { resource: 'settings', action: 'manage', description: 'Organization settings' },
          { resource: 'finance', action: 'manage', description: 'Financial management' },
          { resource: 'recruitment', action: 'manage', description: 'Recruitment management' },
          { resource: 'logistics', action: 'manage', description: 'Logistics management' },
        ],
        securityLevel: 5,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-moderator',
        name: 'Moderator',
        type: PermissionTemplateType.MODERATOR,
        description: 'Moderate content and manage day-to-day operations',
        permissions: [
          { resource: 'fleet', action: 'read', description: 'View fleet information' },
          { resource: 'fleet', action: 'edit', description: 'Edit fleet details' },
          { resource: 'events', action: 'create', description: 'Create events' },
          { resource: 'events', action: 'edit', description: 'Edit events' },
          { resource: 'events', action: 'delete', description: 'Delete events' },
          { resource: 'members', action: 'read', description: 'View members' },
          { resource: 'members', action: 'moderate', description: 'Moderate member actions' },
        ],
        securityLevel: 3,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-member',
        name: 'Regular Member',
        type: PermissionTemplateType.MEMBER,
        description: 'Standard member access to organization resources',
        permissions: [
          { resource: 'fleet', action: 'read', description: 'View fleet information' },
          { resource: 'events', action: 'read', description: 'View events' },
          { resource: 'events', action: 'rsvp', description: 'RSVP to events' },
          { resource: 'members', action: 'read', description: 'View members' },
        ],
        securityLevel: 1,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-recruiter',
        name: 'Recruiter',
        type: PermissionTemplateType.RECRUITER,
        description: 'Manage recruitment and onboarding',
        permissions: [
          { resource: 'recruitment', action: 'manage', description: 'Manage recruitment' },
          { resource: 'members', action: 'read', description: 'View members' },
          { resource: 'members', action: 'invite', description: 'Invite new members' },
          { resource: 'events', action: 'read', description: 'View events' },
          { resource: 'fleet', action: 'read', description: 'View fleet information' },
        ],
        securityLevel: 2,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-fleet-commander',
        name: 'Fleet Commander',
        type: PermissionTemplateType.FLEET_COMMANDER,
        description: 'Lead fleet operations and tactical missions',
        permissions: [
          { resource: 'fleet', action: 'manage', description: 'Full fleet management' },
          { resource: 'events', action: 'create', description: 'Create tactical events' },
          { resource: 'events', action: 'edit', description: 'Edit tactical events' },
          { resource: 'events', action: 'manage', description: 'Manage event roles' },
          { resource: 'logistics', action: 'read', description: 'View logistics' },
          { resource: 'members', action: 'read', description: 'View members' },
        ],
        securityLevel: 3,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-event-coordinator',
        name: 'Event Coordinator',
        type: PermissionTemplateType.EVENT_COORDINATOR,
        description: 'Organize and manage organization events',
        permissions: [
          { resource: 'events', action: 'create', description: 'Create events' },
          { resource: 'events', action: 'edit', description: 'Edit events' },
          { resource: 'events', action: 'delete', description: 'Delete events' },
          { resource: 'events', action: 'manage', description: 'Manage attendees' },
          { resource: 'members', action: 'read', description: 'View members' },
          { resource: 'fleet', action: 'read', description: 'View fleet information' },
        ],
        securityLevel: 2,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-finance-manager',
        name: 'Finance Manager',
        type: PermissionTemplateType.FINANCE_MANAGER,
        description: 'Manage organization finances and resources',
        permissions: [
          { resource: 'finance', action: 'manage', description: 'Full financial management' },
          { resource: 'logistics', action: 'read', description: 'View logistics' },
          { resource: 'fleet', action: 'read', description: 'View fleet information' },
          { resource: 'members', action: 'read', description: 'View members' },
        ],
        securityLevel: 3,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'system-guest',
        name: 'Guest',
        type: PermissionTemplateType.GUEST,
        description: 'Limited read-only access for temporary guests',
        permissions: [
          { resource: 'events', action: 'read', description: 'View public events' },
          { resource: 'members', action: 'read', description: 'View member list' },
        ],
        securityLevel: 0,
        isSystemTemplate: true,
        createdBy: 'system',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    systemTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });

    logger.info(`Initialized ${systemTemplates.length} system permission templates`);
  }

  /**
   * Get all available templates
   */
  public listTemplates(organizationId?: string): PermissionTemplate[] {
    const templates = Array.from(this.templates.values());

    if (organizationId) {
      // Return system templates + organization-specific templates
      return templates.filter(t => t.isSystemTemplate || t.organizationId === organizationId);
    }

    // Return only system templates
    return templates.filter(t => t.isSystemTemplate);
  }

  /**
   * Get template by ID
   */
  public getTemplate(templateId: string): PermissionTemplate | undefined {
    return this.templates.get(templateId);
  }

  /**
   * Create custom template
   */
  public createTemplate(
    name: string,
    description: string,
    permissions: PermissionTemplateItem[],
    securityLevel: number,
    organizationId: string,
    createdBy: string
  ): PermissionTemplate {
    const template: PermissionTemplate = {
      id: `custom-${uuidv4()}`,
      name,
      type: PermissionTemplateType.CUSTOM,
      description,
      permissions,
      securityLevel,
      isSystemTemplate: false,
      organizationId,
      createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.templates.set(template.id, template);
    logger.info(`Created custom permission template: ${template.name} (${template.id})`);

    return template;
  }

  /**
   * Update custom template
   */
  public updateTemplate(
    templateId: string,
    updates: Partial<PermissionTemplate>
  ): PermissionTemplate | null {
    const template = this.templates.get(templateId);

    if (!template) {
      return null;
    }

    if (template.isSystemTemplate) {
      throw new Error('Cannot modify system templates');
    }

    Object.assign(template, updates, { updatedAt: new Date() });
    this.templates.set(templateId, template);

    logger.info(`Updated permission template: ${template.name} (${templateId})`);
    return template;
  }

  /**
   * Delete custom template
   */
  public deleteTemplate(templateId: string): boolean {
    const template = this.templates.get(templateId);

    if (!template) {
      return false;
    }

    if (template.isSystemTemplate) {
      throw new Error('Cannot delete system templates');
    }

    this.templates.delete(templateId);
    logger.info(`Deleted permission template: ${template.name} (${templateId})`);

    return true;
  }

  /**
   * Apply template to user
   */
  public async applyTemplate(
    templateId: string,
    userId: string,
    organizationId: string,
    appliedBy: string,
    reason?: string
  ): Promise<void> {
    const template = this.templates.get(templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    // Update security level
    const userOrg = await this.userOrgRepository.findOne({
      where: { userId, organizationId, isActive: true },
    });

    if (!userOrg) {
      throw new Error('User not member of organization');
    }

    const previousSecurityLevel = userOrg.securityLevel;
    userOrg.securityLevel = template.securityLevel;
    await this.userOrgRepository.save(userOrg);

    // Grant all permissions from template
    for (const perm of template.permissions) {
      await this.permissionManager.grantPermission(
        organizationId,
        userId,
        perm.resource,
        perm.action,
        appliedBy
      );
    }

    // Log audit entry
    const auditEntry: PermissionAuditEntry = {
      id: uuidv4(),
      eventType: 'TEMPLATE_APPLY',
      userId: appliedBy,
      username: 'Unknown', // Would need to fetch from user service
      organizationId,
      targetUserId: userId,
      targetUsername: 'Unknown', // Would need to fetch from user service
      previousValue: previousSecurityLevel,
      newValue: template.securityLevel,
      reason,
      performedBy: appliedBy,
      performedByUsername: 'Unknown', // Would need to fetch from user service
      timestamp: new Date(),
      metadata: {
        templateId,
        templateName: template.name,
        permissionsGranted: template.permissions.length,
      },
    };

    this.auditLog.push(auditEntry);

    logAuditEvent({
      eventType: AuditEventType.PERMISSION_GRANTED,
      userId,
      actorId: appliedBy,
      organizationId,
      description: `Applied permission template: ${template.name}`,
      metadata: { templateId, reason },
    } as unknown as AuditLogEntry);

    logger.info(`Applied template ${template.name} to user ${userId} in org ${organizationId}`);
  }

  /**
   * Get permission usage statistics for a user
   */
  public async getUserPermissionStats(
    userId: string,
    organizationId: string
  ): Promise<PermissionUsageStats | null> {
    const permissions = await this.permissionRepository.find({
      where: { userId, organizationId },
    });

    if (permissions.length === 0) {
      return null;
    }

    const now = new Date();
    const activePermissions = permissions.filter(p => !p.expiresAt || p.expiresAt > now);
    const expiredPermissions = permissions.filter(p => p.expiresAt && p.expiresAt <= now);

    // Calculate most used permissions (would need usage tracking)
    const permissionCounts = new Map<string, number>();
    permissions.forEach(p => {
      const key = `${p.resource}:${p.action}`;
      permissionCounts.set(key, (permissionCounts.get(key) || 0) + 1);
    });

    const mostUsedPermissions = Array.from(permissionCounts.entries())
      .map(([key, count]) => {
        const [resource, action] = key.split(':');
        return { resource: resource || '', action: action || '', usageCount: count };
      })
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);

    return {
      userId,
      username: 'Unknown', // Would fetch from user service
      organizationId,
      organizationName: 'Unknown', // Would fetch from org service
      totalPermissions: permissions.length,
      activePermissions: activePermissions.length,
      expiredPermissions: expiredPermissions.length,
      lastUsed:
        permissions.length > 0
          ? (permissions[0] as unknown as Record<string, unknown>).grantedAt as Date || permissions[0]?.granted
          : undefined,
      mostUsedPermissions,
    };
  }

  /**
   * Generate permission usage report for organization
   */
  public async generateUsageReport(organizationId: string): Promise<PermissionUsageReport> {
    const allPermissions = await this.permissionRepository.find({
      where: { organizationId },
    });

    const userOrgs = await this.userOrgRepository.find({
      where: { organizationId, isActive: true },
    });

    const now = new Date();
    const activePermissions = allPermissions.filter(p => !p.expiresAt || p.expiresAt > now);
    const expiredPermissions = allPermissions.filter(p => p.expiresAt && p.expiresAt <= now);

    // Permission types distribution
    const permissionsByType: Record<string, number> = {};
    allPermissions.forEach(p => {
      const key = `${p.resource}:${p.action}`;
      permissionsByType[key] = (permissionsByType[key] || 0) + 1;
    });

    // Security level distribution
    const securityLevelDistribution: Record<number, number> = {};
    userOrgs.forEach(uo => {
      const level = uo.securityLevel || 0;
      securityLevelDistribution[level] = (securityLevelDistribution[level] || 0) + 1;
    });

    // Get top users by permission count
    const userPermissionCounts = new Map<string, number>();
    allPermissions.forEach(p => {
      userPermissionCounts.set(p.userId, (userPermissionCounts.get(p.userId) || 0) + 1);
    });

    const topUserIds = Array.from(userPermissionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId]) => userId);

    const topUsers: PermissionUsageStats[] = [];
    for (const userId of topUserIds) {
      const stats = await this.getUserPermissionStats(userId, organizationId);
      if (stats) {
        topUsers.push(stats);
      }
    }

    // Template usage (would need to track this separately)
    const templatesUsed: Record<string, number> = {};

    // Recent audit entries
    const recentChanges = this.auditLog
      .filter(entry => entry.organizationId === organizationId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 20);

    return {
      organizationId,
      organizationName: 'Unknown', // Would fetch from org service
      reportDate: new Date(),
      totalUsers: userOrgs.length,
      totalPermissions: allPermissions.length,
      activePermissions: activePermissions.length,
      expiredPermissions: expiredPermissions.length,
      permissionsByType,
      topUsers,
      recentChanges,
      securityLevelDistribution,
      templatesUsed,
    };
  }

  /**
   * Get audit log entries
   */
  public getAuditLog(
    organizationId?: string,
    userId?: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 100
  ): PermissionAuditEntry[] {
    let filtered = this.auditLog;

    if (organizationId) {
      filtered = filtered.filter(entry => entry.organizationId === organizationId);
    }

    if (userId) {
      filtered = filtered.filter(entry => entry.userId === userId || entry.targetUserId === userId);
    }

    if (startDate) {
      filtered = filtered.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(entry => entry.timestamp <= endDate);
    }

    return filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }

  /**
   * Log permission change audit entry
   */
  public logPermissionChange(
    eventType: PermissionAuditEntry['eventType'],
    userId: string,
    organizationId: string,
    performedBy: string,
    details: Partial<PermissionAuditEntry>
  ): void {
    const entry: PermissionAuditEntry = {
      id: uuidv4(),
      eventType,
      userId,
      username: 'Unknown', // Would fetch from user service
      organizationId,
      performedBy,
      performedByUsername: 'Unknown', // Would fetch from user service
      timestamp: new Date(),
      ...details,
    };

    this.auditLog.push(entry);

    logger.info(`Permission audit: ${eventType} for user ${userId} in org ${organizationId}`);
  }

  /**
   * Get service statistics
   */
  public getServiceStats(): {
    totalTemplates: number;
    systemTemplates: number;
    customTemplates: number;
    auditLogEntries: number;
  } {
    const templates = Array.from(this.templates.values());

    return {
      totalTemplates: templates.length,
      systemTemplates: templates.filter(t => t.isSystemTemplate).length,
      customTemplates: templates.filter(t => !t.isSystemTemplate).length,
      auditLogEntries: this.auditLog.length,
    };
  }
}

