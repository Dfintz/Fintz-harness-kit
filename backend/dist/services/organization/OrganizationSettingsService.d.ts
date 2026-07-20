import { OrganizationSettings } from '../../models/Organization';
export interface SettingsValidation {
    valid: boolean;
    errors: string[];
}
export declare class OrganizationSettingsService {
    private organizationRepository;
    getSettings(orgId: string): Promise<OrganizationSettings | null>;
    getEffectiveSettings(orgId: string): Promise<OrganizationSettings>;
    getSetting<T = unknown>(orgId: string, key: keyof OrganizationSettings, useInheritance?: boolean): Promise<T | undefined>;
    updateSettings(orgId: string, updates: Partial<OrganizationSettings>, merge?: boolean): Promise<OrganizationSettings>;
    updateSetting<K extends keyof OrganizationSettings>(orgId: string, key: K, value: OrganizationSettings[K]): Promise<OrganizationSettings>;
    deleteSetting(orgId: string, key: keyof OrganizationSettings): Promise<OrganizationSettings>;
    resetSettings(orgId: string): Promise<OrganizationSettings>;
    validateSettings(orgId: string, settings: Partial<OrganizationSettings>): Promise<SettingsValidation>;
    isSettingAllowed(orgId: string, key: keyof OrganizationSettings): Promise<boolean>;
    propagateSettingToChildren(orgId: string, key: keyof OrganizationSettings, value: unknown, force?: boolean): Promise<number>;
    propagateAllSettingsToChildren(orgId: string, force?: boolean): Promise<number>;
    inheritFromParent(orgId: string, overwrite?: boolean): Promise<OrganizationSettings>;
    getCustomField<T = unknown>(orgId: string, fieldName: string): Promise<T | undefined>;
    setCustomField(orgId: string, fieldName: string, value: unknown): Promise<OrganizationSettings>;
    deleteCustomField(orgId: string, fieldName: string): Promise<OrganizationSettings>;
    getCustomFields(orgId: string): Promise<Record<string, unknown>>;
    compareWithParent(orgId: string): Promise<{
        inherited: Record<string, unknown>;
        overridden: Record<string, unknown>;
        parentOnly: Record<string, unknown>;
        childOnly: Record<string, unknown>;
    }>;
    applyTemplate(orgId: string, templateName: 'open' | 'restricted' | 'locked'): Promise<OrganizationSettings>;
}
//# sourceMappingURL=OrganizationSettingsService.d.ts.map