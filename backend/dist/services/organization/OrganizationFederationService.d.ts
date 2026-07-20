import type { FederationAssociationType, FederationFleetsResponse, FederationGovernance, FederationRole, FederationSettings, FederationStats, FederationTreaty, FederationUnitsResponse, ProposalStatus, ProposalType, PublicFederationListItem, SharedResource, UpdateFederationSettingsRequest, VoteChoice } from '@sc-fleet-manager/shared-types';
import type { FederationConfig, FederationMemberData, FederationProposalData } from './OrganizationFederationService.types';
export type { FederationGovernance, FederationRole, FederationStats, FederationTreaty, FederationVote, ProposalStatus, ProposalType, PublicFederationListItem, SharedResource, VoteChoice, } from '@sc-fleet-manager/shared-types';
export type { FederationConfig, FederationMemberData, FederationProposalData, } from './OrganizationFederationService.types';
export declare class OrganizationFederationService {
    private static instance;
    private readonly organizationRepository;
    private readonly relationshipRepository;
    private readonly diplomacyRepository;
    private readonly profileRepository;
    private readonly federationRepository;
    private readonly memberRepository;
    private readonly proposalRepository;
    constructor();
    static getInstance(): OrganizationFederationService;
    private toFederationConfig;
    private toMemberData;
    private notifyOrgLeaders;
    private toProposalData;
    private loadFederation;
    private loadFederationMetadataOnly;
    private findMember;
    createFederation(founderId: string, founderOrgId: string, founderOrgName: string | undefined, data: {
        name: string;
        description: string;
        governance?: Partial<FederationGovernance>;
        isPublic?: boolean;
        tags?: string[];
    }): Promise<FederationConfig>;
    getFederation(federationId: string): Promise<FederationConfig | null>;
    resolveBySlug(slug: string): Promise<{
        id: string;
        name: string;
    } | null>;
    disbandFederation(federationId: string, actorOrgId: string): Promise<void>;
    getOrganizationFederations(organizationId: string): Promise<FederationConfig[]>;
    searchFederations(filters?: {
        name?: string;
        tags?: string[];
        minMembers?: number;
        maxMembers?: number;
    }): Promise<FederationConfig[]>;
    updateFederation(federationId: string, actorOrgId: string, updates: {
        name?: string;
        description?: string;
        isPublic?: boolean;
        tags?: string[];
        governance?: FederationGovernance;
        logoUrl?: string | null;
        bannerUrl?: string | null;
        discordUrl?: string | null;
        websiteUrl?: string | null;
        reviewDate?: string | null;
        expiryDate?: string | null;
        autoRenew?: boolean;
    }): Promise<FederationConfig | null>;
    private validateUniqueName;
    private validateGovernanceUpdate;
    private applyOptionalFields;
    activateFederation(federationId: string, actorOrgId: string): Promise<FederationConfig | null>;
    inviteMember(federationId: string, inviterOrgId: string, targetOrgId: string, targetOrgName: string, role?: FederationRole, associationType?: FederationAssociationType): Promise<FederationMemberData>;
    acceptInvitation(federationId: string, organizationId: string): Promise<FederationMemberData | null>;
    removeMember(federationId: string, actorOrgId: string, targetOrgId: string, reason?: string): Promise<void>;
    updateMemberRole(federationId: string, actorOrgId: string, targetOrgId: string, newRole: FederationRole): Promise<FederationMemberData | null>;
    updateSuccessionMode(federationId: string, actorOrgId: string, mode: 'fixed' | 'rotation' | 'election', leaderTermDays?: number): Promise<FederationGovernance>;
    succeedChairman(federationId: string, actorOrgId: string): Promise<FederationGovernance>;
    private rotateChairman;
    private startChairmanElection;
    createProposal(federationId: string, proposerOrgId: string, proposerName: string, data: {
        type: ProposalType;
        title: string;
        description: string;
        votingDurationDays?: number;
        metadata?: Record<string, unknown>;
    }): Promise<FederationProposalData>;
    castVote(proposalId: string, organizationId: string, organizationName: string, voterId: string, vote: VoteChoice, comment?: string): Promise<FederationProposalData>;
    getProposal(proposalId: string): Promise<FederationProposalData | null>;
    getFederationProposals(federationId: string, status?: ProposalStatus): Promise<FederationProposalData[]>;
    addSharedResource(federationId: string, providerOrgId: string, resource: Omit<SharedResource, 'id'>): Promise<SharedResource>;
    removeSharedResource(federationId: string, resourceId: string, actorOrgId: string): Promise<void>;
    createTreaty(federationId: string, creatorOrgId: string, treaty: Pick<FederationTreaty, 'name' | 'type' | 'terms'> & {
        effectiveDate?: string;
        expirationDate?: string;
    }): Promise<FederationTreaty>;
    respondToTreaty(federationId: string, treatyId: string, actorOrgId: string, action: 'sign' | 'reject'): Promise<FederationTreaty>;
    terminateTreaty(federationId: string, treatyId: string, actorOrgId: string): Promise<void>;
    getFederationStats(federationId: string): Promise<FederationStats>;
    getMemberContributions(federationId: string): Promise<Array<{
        organizationId: string;
        organizationName: string;
        role: string;
        contributions: number;
        sharedResources: number;
        votingParticipation: number;
    }>>;
    private createMemberRelationships;
    private checkAndResolveProposal;
    private executeProposal;
    getPublicFederations(filters?: {
        name?: string;
        tags?: string[];
        minMembers?: number;
        maxMembers?: number;
    }, pagination?: {
        page?: number;
        limit?: number;
        sortBy?: 'memberCount' | 'createdAt' | 'name';
        sortOrder?: 'ASC' | 'DESC';
    }): Promise<{
        data: PublicFederationListItem[];
        pagination: {
            total: number;
            page: number;
            limit: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    getPublicFederation(identifier: string): Promise<PublicFederationListItem | null>;
    getPublicFederationStats(): Promise<{
        totalFederations: number;
        totalMemberOrganizations: number;
        averageMembersPerFederation: number;
        byTag: Record<string, number>;
    }>;
    getPublicFederationsForOrg(organizationId: string): Promise<Array<{
        id: string;
        slug?: string;
        name: string;
        description: string;
        memberCount: number;
        role: string;
        tags: string[];
        logoUrl?: string | null;
    }>>;
    hasAllianceManageAccess(allianceId: string, userId: string): Promise<boolean>;
    getFederationSettings(federationId: string, actorOrgId: string): Promise<FederationSettings>;
    updateFederationSettings(federationId: string, actorOrgId: string, updates: UpdateFederationSettingsRequest): Promise<FederationSettings>;
    private loadTreatySharedFleets;
    private batchLoadFleetShipCounts;
    private buildFleetItem;
    getFederationFleets(federationId: string, actorOrgId: string): Promise<FederationFleetsResponse>;
    getFederationUnits(federationId: string, actorOrgId: string): Promise<FederationUnitsResponse>;
    seedDemoFederations(): Promise<void>;
}
//# sourceMappingURL=OrganizationFederationService.d.ts.map