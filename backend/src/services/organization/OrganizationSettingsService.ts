import { AppDataSource } from '../../data-source';
import { Organization, OrganizationSettings } from '../../models/Organization';
import { logger } from '../../utils/logger';

import { OrgSettingsAuditAction, orgSettingsAuditLogger } from './OrgSettingsAuditLogger';

/**
 * Settings validation result
 */
export interface SettingsValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Service for managing organization settings
 * Handles settings CRUD, validation, and inheritance
 */
export class OrganizationSettingsService {
  private organizationRepository = AppDataSource.getRepository(Organization);

  // ==================== SETTINGS RETRIEVAL ====================

  /**
   * Get organization settings
   * @param orgId Organization ID
   * @returns Organization settings
   */
  async getSettings(orgId: string): Promise<OrganizationSettings | null> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    return org.settings || null;
  }

  /**
   * Get effective settings (with inheritance)
   * @param orgId Organization ID
   * @returns Settings with inherited values
   */
  async getEffectiveSettings(orgId: string): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Start with organization's own settings
    let effectiveSettings: OrganizationSettings = { ...org.settings };

    // If organization has parent and inheritance is enabled, merge parent settings
    if (org.parentOrgId && org.settings?.inheritPermissions !== false) {
      const parentSettings = await this.getEffectiveSettings(org.parentOrgId);
      effectiveSettings = { ...parentSettings, ...effectiveSettings };
    }

    return effectiveSettings;
  }

  /**
   * Get setting value by key
   * @param orgId Organization ID
   * @param key Setting key
   * @param useInheritance Whether to check parent settings
   * @returns Setting value
   */
  async getSetting<T = unknown>(
    orgId: string,
    key: keyof OrganizationSettings,
    useInheritance: boolean = true
  ): Promise<T | undefined> {
    if (useInheritance) {
      const effectiveSettings = await this.getEffectiveSettings(orgId);
      return effectiveSettings[key] as T;
    } else {
      const settings = await this.getSettings(orgId);
      return settings?.[key] as T;
    }
  }

  // ==================== SETTINGS MANAGEMENT ====================

  /**
   * Update organization settings
   * @param orgId Organization ID
   * @param updates Settings to update
   * @param merge Whether to merge with existing settings
   * @returns Updated settings
   */
  async updateSettings(
    orgId: string,
    updates: Partial<OrganizationSettings>,
    merge: boolean = true
  ): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Validate settings before applying
    const validation = await this.validateSettings(orgId, updates);
    if (!validation.valid) {
      throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
    }

    // Merge or replace settings
    const newSettings = merge ? { ...org.settings, ...updates } : updates;

    // Update organization
    org.settings = newSettings;
    await this.organizationRepository.save(org);

    logger.info('OrganizationSettingsService.updateSettings: Settings updated', {
      orgId,
      updatedKeys: Object.keys(updates),
      merge,
    });
    orgSettingsAuditLogger.log({
      action: OrgSettingsAuditAction.ORG_SETTINGS_UPDATED,
      organizationId: orgId,
      settingCategory: 'defaults',
      settingKey: Object.keys(updates).join(','),
      newValue: updates,
      performedById: 'system',
      details: { updatedKeys: Object.keys(updates), merge },
    });

    return org.settings;
  }

  /**
   * Update single setting
   * @param orgId Organization ID
   * @param key Setting key
   * @param value Setting value
   * @returns Updated settings
   */
  async updateSetting<K extends keyof OrganizationSettings>(
    orgId: string,
    key: K,
    value: OrganizationSettings[K]
  ): Promise<OrganizationSettings> {
    return this.updateSettings(orgId, { [key]: value });
  }

  /**
   * Delete setting
   * @param orgId Organization ID
   * @param key Setting key
   * @returns Updated settings
   */
  async deleteSetting(
    orgId: string,
    key: keyof OrganizationSettings
  ): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (org.settings) {
      // Spread-and-replace to ensure TypeORM detects the JSONB change.
      // See /memories/repo/typeorm-jsonb-pitfall.md
      const next = { ...org.settings };
      delete next[key];
      org.settings = next;
      await this.organizationRepository.save(org);

      logger.info('OrganizationSettingsService.deleteSetting: Setting deleted', { orgId, key });
      orgSettingsAuditLogger.log({
        action: OrgSettingsAuditAction.ORG_SETTINGS_UPDATED,
        organizationId: orgId,
        settingCategory: 'defaults',
        settingKey: String(key),
        previousValue: org.settings?.[key],
        newValue: undefined,
        performedById: 'system',
        details: { deletedKey: key },
      });
    }

    return org.settings || {};
  }

  /**
   * Reset settings to defaults
   * @param orgId Organization ID
   * @returns Default settings
   */
  async resetSettings(orgId: string): Promise<OrganizationSettings> {
    const defaultSettings: OrganizationSettings = {
      visibility: 'private',
      allowSubOrgs: true,
      maxDepth: 5,
      requireApproval: false,
      inheritPermissions: true,
    };

    return this.updateSettings(orgId, defaultSettings, false);
  }

  // ==================== SETTINGS VALIDATION ====================

  /**
   * Validate settings
   * @param orgId Organization ID
   * @param settings Settings to validate
   * @returns Validation result
   */
  async validateSettings(
    orgId: string,
    settings: Partial<OrganizationSettings>
  ): Promise<SettingsValidation> {
    const errors: string[] = [];

    // Validate visibility
    if (settings.visibility) {
      const validVisibility = ['public', 'private', 'restricted'];
      if (!validVisibility.includes(settings.visibility)) {
        errors.push(`Invalid visibility: ${settings.visibility}`);
      }
    }

    // Validate maxDepth
    if (settings.maxDepth !== undefined) {
      if (
        typeof settings.maxDepth !== 'number' ||
        settings.maxDepth < 1 ||
        settings.maxDepth > 20
      ) {
        errors.push('maxDepth must be between 1 and 20');
      }

      // Check if current hierarchy depth exceeds new maxDepth
      const org = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (org) {
        // Get all descendants and check their levels
        const descendants = await this.organizationRepository.find({
          where: {
            path: `${org.path}.%`, // Using LIKE pattern
          },
        });

        const maxDescendantLevel = descendants.reduce(
          (max, d) => Math.max(max, d.level),
          org.level
        );

        const currentDepth = maxDescendantLevel - org.level;
        if (currentDepth > settings.maxDepth) {
          errors.push(
            `Cannot set maxDepth to ${settings.maxDepth} - current hierarchy depth is ${currentDepth}`
          );
        }
      }
    }

    // Validate allowSubOrgs
    if (settings.allowSubOrgs === false) {
      // Check if organization has children
      const org = await this.organizationRepository.findOne({
        where: { id: orgId },
      });

      if (org && org.childCount > 0) {
        errors.push('Cannot disable sub-organizations when children exist');
      }
    }

    // Validate customFields
    if (settings.customFields) {
      if (typeof settings.customFields !== 'object') {
        errors.push('customFields must be an object');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if setting is allowed for organization
   * @param orgId Organization ID
   * @param key Setting key
   * @returns True if allowed
   */
  async isSettingAllowed(orgId: string, key: keyof OrganizationSettings): Promise<boolean> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      return false;
    }

    // Root organizations can set all settings
    if (org.isRoot()) {
      return true;
    }

    // Check if parent allows this setting to be overridden
    if (org.parentOrgId) {
      const parentSettings = await this.getSettings(org.parentOrgId);

      // If parent has locked settings, child cannot override
      if (parentSettings?.inheritPermissions === true) {
        // Some settings might be locked by parent
        const lockedSettings: (keyof OrganizationSettings)[] = ['visibility'];
        return !lockedSettings.includes(key);
      }
    }

    return true;
  }

  // ==================== SETTINGS INHERITANCE ====================

  /**
   * Propagate setting to child organizations
   * @param orgId Organization ID
   * @param key Setting key
   * @param value Setting value
   * @param force Force update even if child has custom value
   * @returns Number of children updated
   */
  async propagateSettingToChildren(
    orgId: string,
    key: keyof OrganizationSettings,
    value: unknown,
    force: boolean = false
  ): Promise<number> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Get all child organizations
    const children = await this.organizationRepository.find({
      where: {
        parentOrgId: orgId,
      },
    });

    let updatedCount = 0;

    for (const child of children) {
      // Skip if child has custom value and force is false
      if (!force && child.settings?.[key] !== undefined) {
        continue;
      }

      // Skip if child doesn't inherit permissions
      if (child.settings?.inheritPermissions === false) {
        continue;
      }

      // Update child setting
      child.settings = child.settings || {};
      (child.settings as Record<string, unknown>)[key] = value;
      await this.organizationRepository.save(child);
      updatedCount++;

      // Recursively propagate to grandchildren
      const childUpdates = await this.propagateSettingToChildren(child.id, key, value, force);
      updatedCount += childUpdates;
    }

    return updatedCount;
  }

  /**
   * Propagate all settings to children
   * @param orgId Organization ID
   * @param force Force update even if child has custom values
   * @returns Number of children updated
   */
  async propagateAllSettingsToChildren(orgId: string, force: boolean = false): Promise<number> {
    const settings = await this.getSettings(orgId);
    if (!settings) {
      return 0;
    }

    let totalUpdated = 0;

    for (const key of Object.keys(settings) as Array<keyof OrganizationSettings>) {
      const updated = await this.propagateSettingToChildren(orgId, key, settings[key], force);
      totalUpdated += updated;
    }

    return totalUpdated;
  }

  /**
   * Inherit settings from parent
   * @param orgId Organization ID
   * @param overwrite Overwrite existing settings
   * @returns Updated settings
   */
  async inheritFromParent(
    orgId: string,
    overwrite: boolean = false
  ): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (!org.parentOrgId) {
      throw new Error('Organization has no parent');
    }

    const parentSettings = await this.getSettings(org.parentOrgId);
    if (!parentSettings) {
      return org.settings || {};
    }

    // Merge or overwrite settings
    const newSettings = overwrite ? { ...parentSettings } : { ...parentSettings, ...org.settings };

    org.settings = newSettings;
    await this.organizationRepository.save(org);

    return org.settings;
  }

  // ==================== CUSTOM FIELDS ====================

  /**
   * Get custom field value
   * @param orgId Organization ID
   * @param fieldName Custom field name
   * @returns Field value
   */
  async getCustomField<T = unknown>(orgId: string, fieldName: string): Promise<T | undefined> {
    const settings = await this.getSettings(orgId);
    return settings?.customFields?.[fieldName] as T;
  }

  /**
   * Set custom field value
   * @param orgId Organization ID
   * @param fieldName Custom field name
   * @param value Field value
   * @returns Updated settings
   */
  async setCustomField(
    orgId: string,
    fieldName: string,
    value: unknown
  ): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    // Spread-and-replace to ensure TypeORM detects the JSONB change.
    // See /memories/repo/typeorm-jsonb-pitfall.md
    const nextSettings = { ...org.settings };
    nextSettings.customFields = {
      ...nextSettings.customFields,
      [fieldName]: value,
    };
    org.settings = nextSettings;

    await this.organizationRepository.save(org);

    return org.settings;
  }

  /**
   * Delete custom field
   * @param orgId Organization ID
   * @param fieldName Custom field name
   * @returns Updated settings
   */
  async deleteCustomField(orgId: string, fieldName: string): Promise<OrganizationSettings> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org) {
      throw new Error('Organization not found');
    }

    if (org.settings?.customFields) {
      // Spread-and-replace to ensure TypeORM detects the JSONB change.
      // See /memories/repo/typeorm-jsonb-pitfall.md
      const nextCustomFields = { ...org.settings.customFields };
      delete nextCustomFields[fieldName];
      org.settings = { ...org.settings, customFields: nextCustomFields };
      await this.organizationRepository.save(org);
    }

    return org.settings || {};
  }

  /**
   * Get all custom fields
   * @param orgId Organization ID
   * @returns Custom fields object
   */
  async getCustomFields(orgId: string): Promise<Record<string, unknown>> {
    const settings = await this.getSettings(orgId);
    return settings?.customFields || {};
  }

  // ==================== SETTINGS COMPARISON ====================

  /**
   * Compare settings with parent
   * @param orgId Organization ID
   * @returns Differences from parent settings
   */
  async compareWithParent(orgId: string): Promise<{
    inherited: Record<string, unknown>;
    overridden: Record<string, unknown>;
    parentOnly: Record<string, unknown>;
    childOnly: Record<string, unknown>;
  }> {
    const org = await this.organizationRepository.findOne({
      where: { id: orgId },
    });

    if (!org?.parentOrgId) {
      return { inherited: {}, overridden: {}, parentOnly: {}, childOnly: {} };
    }

    const childSettings = (await this.getSettings(orgId)) || {};
    const parentSettings = (await this.getSettings(org.parentOrgId)) || {};

    const inherited: Record<string, unknown> = {};
    const overridden: Record<string, unknown> = {};
    const parentOnly: Record<string, unknown> = {};
    const childOnly: Record<string, unknown> = {};

    // Check parent settings
    for (const key of Object.keys(parentSettings) as Array<keyof OrganizationSettings>) {
      if (childSettings[key] === undefined) {
        parentOnly[key] = parentSettings[key];
      } else if (JSON.stringify(childSettings[key]) === JSON.stringify(parentSettings[key])) {
        inherited[key] = childSettings[key];
      } else {
        overridden[key] = {
          parent: parentSettings[key],
          child: childSettings[key],
        };
      }
    }

    // Check child-only settings
    for (const key of Object.keys(childSettings) as Array<keyof OrganizationSettings>) {
      if (parentSettings[key] === undefined) {
        childOnly[key] = childSettings[key];
      }
    }

    return { inherited, overridden, parentOnly, childOnly };
  }

  // ==================== SETTINGS TEMPLATES ====================

  /**
   * Apply settings template
   * @param orgId Organization ID
   * @param templateName Template name
   * @returns Applied settings
   */
  async applyTemplate(
    orgId: string,
    templateName: 'open' | 'restricted' | 'locked'
  ): Promise<OrganizationSettings> {
    const templates: Record<string, OrganizationSettings> = {
      open: {
        visibility: 'public',
        allowSubOrgs: true,
        maxDepth: 10,
        requireApproval: false,
        inheritPermissions: false,
      },
      restricted: {
        visibility: 'private',
        allowSubOrgs: true,
        maxDepth: 5,
        requireApproval: true,
        inheritPermissions: true,
      },
      locked: {
        visibility: 'restricted',
        allowSubOrgs: false,
        maxDepth: 1,
        requireApproval: true,
        inheritPermissions: true,
      },
    };

    const template = templates[templateName];
    if (!template) {
      throw new Error(`Unknown template: ${templateName}`);
    }

    return this.updateSettings(orgId, template, false);
  }
}
