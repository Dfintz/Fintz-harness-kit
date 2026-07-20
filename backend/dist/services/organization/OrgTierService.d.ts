import { OrgScaleTier, type OrgScalingProfile } from '@sc-fleet-manager/shared-types';
export declare class OrgTierService {
    private static instance;
    static getInstance(): OrgTierService;
    getScaleTier(memberCount: number): OrgScaleTier;
    getScalingProfile(memberCount: number): OrgScalingProfile;
}
export declare const orgTierService: OrgTierService;
//# sourceMappingURL=OrgTierService.d.ts.map