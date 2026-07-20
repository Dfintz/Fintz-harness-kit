import { Activity } from '../../models/Activity';
import { AllianceDiplomacy } from '../../models/AllianceDiplomacy';
import { OrganizationRelationship } from '../../models/OrganizationRelationship';
export declare class AllianceService {
    private relationshipRepository;
    private diplomacyRepository;
    private activityRepository;
    private organizationRepository;
    constructor();
    getAllianceCount(organizationId: string): Promise<number>;
    getAlliances(organizationId: string): Promise<OrganizationRelationship[]>;
    getAllianceDetails(organizationId: string): Promise<{
        relationship: OrganizationRelationship;
        targetOrganizationName: string;
        diplomacy: AllianceDiplomacy | null;
        healthScore: number;
        trustLevel: string;
    }[]>;
    getAllianceStatistics(organizationId: string): Promise<{
        total: number;
        averageHealth: number;
        strong: number;
        needingReview: number;
        mutual: number;
        mutualPercentage: number;
    }>;
    getSharedActivities(organizationId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
    }): Promise<{
        activities: Activity[];
        total: number;
    }>;
    getAllianceWideStats(organizationId: string): Promise<{
        allianceCount: number;
        activeSharedActivities: number;
        upcomingSharedActivities: number;
        alliedOrganizations: string[];
    }>;
    areAllied(org1Id: string, org2Id: string): Promise<boolean>;
    getPendingAllianceProposals(organizationId: string): Promise<OrganizationRelationship[]>;
    getActiveDiplomacy(organizationId: string): Promise<AllianceDiplomacy[]>;
}
//# sourceMappingURL=AllianceService.d.ts.map