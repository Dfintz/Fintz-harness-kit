import { OrgScaleTier, type OrgScalingProfile } from '@sc-fleet-manager/shared-types';

const STANDARD_DASHBOARD_TTL_SECONDS = 300;
const MEGA_DASHBOARD_TTL_SECONDS = 600;
const ULTRA_DASHBOARD_TTL_SECONDS = 900;

export class OrgTierService {
  private static instance: OrgTierService;

  static getInstance(): OrgTierService {
    if (!OrgTierService.instance) {
      OrgTierService.instance = new OrgTierService();
    }

    return OrgTierService.instance;
  }

  getScaleTier(memberCount: number): OrgScaleTier {
    if (memberCount >= 10_000) {
      return OrgScaleTier.ULTRA;
    }

    if (memberCount >= 2_000) {
      return OrgScaleTier.MEGA;
    }

    if (memberCount >= 500) {
      return OrgScaleTier.LARGE;
    }

    return OrgScaleTier.STANDARD;
  }

  getScalingProfile(memberCount: number): OrgScalingProfile {
    const normalizedMemberCount = Math.max(0, memberCount);
    const tier = this.getScaleTier(normalizedMemberCount);

    switch (tier) {
      case OrgScaleTier.ULTRA:
        return {
          tier,
          memberCount: normalizedMemberCount,
          dashboardCacheTtlSeconds: ULTRA_DASHBOARD_TTL_SECONDS,
          recommendedPageSize: 50,
        };
      case OrgScaleTier.MEGA:
        return {
          tier,
          memberCount: normalizedMemberCount,
          dashboardCacheTtlSeconds: MEGA_DASHBOARD_TTL_SECONDS,
          recommendedPageSize: 100,
        };
      case OrgScaleTier.LARGE:
        return {
          tier,
          memberCount: normalizedMemberCount,
          dashboardCacheTtlSeconds: STANDARD_DASHBOARD_TTL_SECONDS,
          recommendedPageSize: 100,
        };
      case OrgScaleTier.STANDARD:
      default:
        return {
          tier,
          memberCount: normalizedMemberCount,
          dashboardCacheTtlSeconds: STANDARD_DASHBOARD_TTL_SECONDS,
          recommendedPageSize: 200,
        };
    }
  }
}

export const orgTierService = OrgTierService.getInstance();

