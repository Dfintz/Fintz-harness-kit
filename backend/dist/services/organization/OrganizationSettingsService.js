"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationSettingsService = void 0;
const data_source_1 = require("../../data-source");
const Organization_1 = require("../../models/Organization");
const logger_1 = require("../../utils/logger");
const OrgSettingsAuditLogger_1 = require("./OrgSettingsAuditLogger");
class OrganizationSettingsService {
    organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
    async getSettings(orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        return org.settings || null;
    }
    async getEffectiveSettings(orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        let effectiveSettings = { ...org.settings };
        if (org.parentOrgId && org.settings?.inheritPermissions !== false) {
            const parentSettings = await this.getEffectiveSettings(org.parentOrgId);
            effectiveSettings = { ...parentSettings, ...effectiveSettings };
        }
        return effectiveSettings;
    }
    async getSetting(orgId, key, useInheritance = true) {
        if (useInheritance) {
            const effectiveSettings = await this.getEffectiveSettings(orgId);
            return effectiveSettings[key];
        }
        else {
            const settings = await this.getSettings(orgId);
            return settings?.[key];
        }
    }
    async updateSettings(orgId, updates, merge = true) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const validation = await this.validateSettings(orgId, updates);
        if (!validation.valid) {
            throw new Error(`Invalid settings: ${validation.errors.join(', ')}`);
        }
        const newSettings = merge ? { ...org.settings, ...updates } : updates;
        org.settings = newSettings;
        await this.organizationRepository.save(org);
        logger_1.logger.info('OrganizationSettingsService.updateSettings: Settings updated', {
            orgId,
            updatedKeys: Object.keys(updates),
            merge,
        });
        OrgSettingsAuditLogger_1.orgSettingsAuditLogger.log({
            action: OrgSettingsAuditLogger_1.OrgSettingsAuditAction.ORG_SETTINGS_UPDATED,
            organizationId: orgId,
            settingCategory: 'defaults',
            settingKey: Object.keys(updates).join(','),
            newValue: updates,
            performedById: 'system',
            details: { updatedKeys: Object.keys(updates), merge },
        });
        return org.settings;
    }
    async updateSetting(orgId, key, value) {
        return this.updateSettings(orgId, { [key]: value });
    }
    async deleteSetting(orgId, key) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        if (org.settings) {
            const next = { ...org.settings };
            delete next[key];
            org.settings = next;
            await this.organizationRepository.save(org);
            logger_1.logger.info('OrganizationSettingsService.deleteSetting: Setting deleted', { orgId, key });
            OrgSettingsAuditLogger_1.orgSettingsAuditLogger.log({
                action: OrgSettingsAuditLogger_1.OrgSettingsAuditAction.ORG_SETTINGS_UPDATED,
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
    async resetSettings(orgId) {
        const defaultSettings = {
            visibility: 'private',
            allowSubOrgs: true,
            maxDepth: 5,
            requireApproval: false,
            inheritPermissions: true,
        };
        return this.updateSettings(orgId, defaultSettings, false);
    }
    async validateSettings(orgId, settings) {
        const errors = [];
        if (settings.visibility) {
            const validVisibility = ['public', 'private', 'restricted'];
            if (!validVisibility.includes(settings.visibility)) {
                errors.push(`Invalid visibility: ${settings.visibility}`);
            }
        }
        if (settings.maxDepth !== undefined) {
            if (typeof settings.maxDepth !== 'number' ||
                settings.maxDepth < 1 ||
                settings.maxDepth > 20) {
                errors.push('maxDepth must be between 1 and 20');
            }
            const org = await this.organizationRepository.findOne({
                where: { id: orgId },
            });
            if (org) {
                const descendants = await this.organizationRepository.find({
                    where: {
                        path: `${org.path}.%`,
                    },
                });
                const maxDescendantLevel = descendants.reduce((max, d) => Math.max(max, d.level), org.level);
                const currentDepth = maxDescendantLevel - org.level;
                if (currentDepth > settings.maxDepth) {
                    errors.push(`Cannot set maxDepth to ${settings.maxDepth} - current hierarchy depth is ${currentDepth}`);
                }
            }
        }
        if (settings.allowSubOrgs === false) {
            const org = await this.organizationRepository.findOne({
                where: { id: orgId },
            });
            if (org && org.childCount > 0) {
                errors.push('Cannot disable sub-organizations when children exist');
            }
        }
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
    async isSettingAllowed(orgId, key) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            return false;
        }
        if (org.isRoot()) {
            return true;
        }
        if (org.parentOrgId) {
            const parentSettings = await this.getSettings(org.parentOrgId);
            if (parentSettings?.inheritPermissions === true) {
                const lockedSettings = ['visibility'];
                return !lockedSettings.includes(key);
            }
        }
        return true;
    }
    async propagateSettingToChildren(orgId, key, value, force = false) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const children = await this.organizationRepository.find({
            where: {
                parentOrgId: orgId,
            },
        });
        let updatedCount = 0;
        for (const child of children) {
            if (!force && child.settings?.[key] !== undefined) {
                continue;
            }
            if (child.settings?.inheritPermissions === false) {
                continue;
            }
            child.settings = child.settings || {};
            child.settings[key] = value;
            await this.organizationRepository.save(child);
            updatedCount++;
            const childUpdates = await this.propagateSettingToChildren(child.id, key, value, force);
            updatedCount += childUpdates;
        }
        return updatedCount;
    }
    async propagateAllSettingsToChildren(orgId, force = false) {
        const settings = await this.getSettings(orgId);
        if (!settings) {
            return 0;
        }
        let totalUpdated = 0;
        for (const key of Object.keys(settings)) {
            const updated = await this.propagateSettingToChildren(orgId, key, settings[key], force);
            totalUpdated += updated;
        }
        return totalUpdated;
    }
    async inheritFromParent(orgId, overwrite = false) {
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
        const newSettings = overwrite ? { ...parentSettings } : { ...parentSettings, ...org.settings };
        org.settings = newSettings;
        await this.organizationRepository.save(org);
        return org.settings;
    }
    async getCustomField(orgId, fieldName) {
        const settings = await this.getSettings(orgId);
        return settings?.customFields?.[fieldName];
    }
    async setCustomField(orgId, fieldName, value) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        const nextSettings = { ...org.settings };
        nextSettings.customFields = {
            ...nextSettings.customFields,
            [fieldName]: value,
        };
        org.settings = nextSettings;
        await this.organizationRepository.save(org);
        return org.settings;
    }
    async deleteCustomField(orgId, fieldName) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org) {
            throw new Error('Organization not found');
        }
        if (org.settings?.customFields) {
            const nextCustomFields = { ...org.settings.customFields };
            delete nextCustomFields[fieldName];
            org.settings = { ...org.settings, customFields: nextCustomFields };
            await this.organizationRepository.save(org);
        }
        return org.settings || {};
    }
    async getCustomFields(orgId) {
        const settings = await this.getSettings(orgId);
        return settings?.customFields || {};
    }
    async compareWithParent(orgId) {
        const org = await this.organizationRepository.findOne({
            where: { id: orgId },
        });
        if (!org?.parentOrgId) {
            return { inherited: {}, overridden: {}, parentOnly: {}, childOnly: {} };
        }
        const childSettings = (await this.getSettings(orgId)) || {};
        const parentSettings = (await this.getSettings(org.parentOrgId)) || {};
        const inherited = {};
        const overridden = {};
        const parentOnly = {};
        const childOnly = {};
        for (const key of Object.keys(parentSettings)) {
            if (childSettings[key] === undefined) {
                parentOnly[key] = parentSettings[key];
            }
            else if (JSON.stringify(childSettings[key]) === JSON.stringify(parentSettings[key])) {
                inherited[key] = childSettings[key];
            }
            else {
                overridden[key] = {
                    parent: parentSettings[key],
                    child: childSettings[key],
                };
            }
        }
        for (const key of Object.keys(childSettings)) {
            if (parentSettings[key] === undefined) {
                childOnly[key] = childSettings[key];
            }
        }
        return { inherited, overridden, parentOnly, childOnly };
    }
    async applyTemplate(orgId, templateName) {
        const templates = {
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
exports.OrganizationSettingsService = OrganizationSettingsService;
//# sourceMappingURL=OrganizationSettingsService.js.map