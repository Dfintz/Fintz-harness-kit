import { OrgScaleTier } from '@sc-fleet-manager/shared-types';

import { OrgTierService } from '../OrgTierService';

describe('OrgTierService', () => {
  const service = OrgTierService.getInstance();

  describe('getScaleTier', () => {
    it('should classify standard organizations below 500 members', () => {
      expect(service.getScaleTier(499)).toBe(OrgScaleTier.STANDARD);
    });

    it('should classify large organizations at 500 members', () => {
      expect(service.getScaleTier(500)).toBe(OrgScaleTier.LARGE);
    });

    it('should classify mega organizations at 2000 members', () => {
      expect(service.getScaleTier(2_000)).toBe(OrgScaleTier.MEGA);
    });

    it('should classify ultra organizations at 10000 members', () => {
      expect(service.getScaleTier(10_000)).toBe(OrgScaleTier.ULTRA);
    });
  });

  describe('getScalingProfile', () => {
    it('should return scaled dashboard TTLs and page sizes for standard orgs', () => {
      expect(service.getScalingProfile(120)).toEqual({
        tier: OrgScaleTier.STANDARD,
        memberCount: 120,
        dashboardCacheTtlSeconds: 300,
        recommendedPageSize: 200,
      });
    });

    it('should increase cache ttl for mega orgs', () => {
      expect(service.getScalingProfile(3_500)).toEqual({
        tier: OrgScaleTier.MEGA,
        memberCount: 3_500,
        dashboardCacheTtlSeconds: 600,
        recommendedPageSize: 100,
      });
    });

    it('should clamp negative member counts to zero', () => {
      expect(service.getScalingProfile(-25)).toEqual({
        tier: OrgScaleTier.STANDARD,
        memberCount: 0,
        dashboardCacheTtlSeconds: 300,
        recommendedPageSize: 200,
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

