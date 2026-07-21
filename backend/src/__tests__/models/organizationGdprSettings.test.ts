/**
 * Organization GDPR Settings Unit Tests
 * 
 * Tests the GDPR settings functionality in the Organization model
 */

import { Organization, GdprSettings, OrganizationSettings } from '../../models/Organization';

describe('Organization GDPR Settings', () => {
    describe('getGdprSettings', () => {
        it('should return default settings when no GDPR settings are configured', () => {
            const org = new Organization();
            org.id = 'org-1';
            org.name = 'Test Organization';
            org.settings = undefined;

            const gdprSettings = org.getGdprSettings();

            expect(gdprSettings).toEqual({
                deletionGracePeriodDays: 30,
                exportLinkExpirationDays: 7
            });
        });

        it('should return default settings when settings exist but no GDPR settings', () => {
            const org = new Organization();
            org.id = 'org-1';
            org.name = 'Test Organization';
            org.settings = {
                visibility: 'public',
                allowSubOrgs: true
            };

            const gdprSettings = org.getGdprSettings();

            expect(gdprSettings).toEqual({
                deletionGracePeriodDays: 30,
                exportLinkExpirationDays: 7
            });
        });

        it('should return organization-specific GDPR settings when configured', () => {
            const org = new Organization();
            org.id = 'org-1';
            org.name = 'Test Organization';
            org.settings = {
                gdpr: {
                    deletionGracePeriodDays: 14,
                    exportLinkExpirationDays: 5
                }
            };

            const gdprSettings = org.getGdprSettings();

            expect(gdprSettings).toEqual({
                deletionGracePeriodDays: 14,
                exportLinkExpirationDays: 5
            });
        });

        it('should use defaults for missing individual GDPR settings', () => {
            const org = new Organization();
            org.id = 'org-1';
            org.name = 'Test Organization';
            org.settings = {
                gdpr: {
                    deletionGracePeriodDays: 20
                    // exportLinkExpirationDays is missing
                }
            };

            const gdprSettings = org.getGdprSettings();

            expect(gdprSettings).toEqual({
                deletionGracePeriodDays: 20,
                exportLinkExpirationDays: 7 // default
            });
        });

        it('should handle partial GDPR settings with undefined values', () => {
            const org = new Organization();
            org.id = 'org-1';
            org.name = 'Test Organization';
            org.settings = {
                gdpr: {
                    deletionGracePeriodDays: undefined,
                    exportLinkExpirationDays: 10
                }
            };

            const gdprSettings = org.getGdprSettings();

            expect(gdprSettings).toEqual({
                deletionGracePeriodDays: 30, // default
                exportLinkExpirationDays: 10
            });
        });

        it('should handle extreme values correctly', () => {
            const org = new Organization();
            org.id = 'org-1';
            org.name = 'Test Organization';
            org.settings = {
                gdpr: {
                    deletionGracePeriodDays: 1,
                    exportLinkExpirationDays: 90
                }
            };

            const gdprSettings = org.getGdprSettings();

            expect(gdprSettings).toEqual({
                deletionGracePeriodDays: 1,
                exportLinkExpirationDays: 90
            });
        });
    });

    describe('GdprSettings interface', () => {
        it('should allow valid GDPR settings', () => {
            const settings: GdprSettings = {
                deletionGracePeriodDays: 15,
                exportLinkExpirationDays: 10
            };

            expect(settings.deletionGracePeriodDays).toBe(15);
            expect(settings.exportLinkExpirationDays).toBe(10);
        });

        it('should allow optional properties', () => {
            const settings1: GdprSettings = {
                deletionGracePeriodDays: 15
            };
            expect(settings1.deletionGracePeriodDays).toBe(15);
            expect(settings1.exportLinkExpirationDays).toBeUndefined();

            const settings2: GdprSettings = {
                exportLinkExpirationDays: 10
            };
            expect(settings2.exportLinkExpirationDays).toBe(10);
            expect(settings2.deletionGracePeriodDays).toBeUndefined();
        });

        it('should allow empty GDPR settings object', () => {
            const settings: GdprSettings = {};
            expect(settings).toEqual({});
        });
    });

    describe('OrganizationSettings with GDPR', () => {
        it('should integrate GDPR settings with other organization settings', () => {
            const settings: OrganizationSettings = {
                visibility: 'public',
                allowSubOrgs: true,
                maxDepth: 5,
                requireApproval: false,
                inheritPermissions: true,
                gdpr: {
                    deletionGracePeriodDays: 20,
                    exportLinkExpirationDays: 14
                }
            };

            expect(settings.visibility).toBe('public');
            expect(settings.gdpr?.deletionGracePeriodDays).toBe(20);
            expect(settings.gdpr?.exportLinkExpirationDays).toBe(14);
        });
    });
});
