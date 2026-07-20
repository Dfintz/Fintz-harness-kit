import type { FederationAssociationType, FederationGovernance, FederationRole, FederationSettings, FederationTreaty, FederationVote, SharedResource } from '@sc-fleet-manager/shared-types';
export interface FederationConfig {
    id: string;
    name: string;
    description: string;
    founderId: string;
    founderOrgId: string;
    createdAt: Date;
    updatedAt: Date;
    governance: FederationGovernance;
    members: FederationMemberData[];
    sharedResources: SharedResource[];
    treaties: FederationTreaty[];
    status: 'active' | 'forming' | 'dissolved';
    isPublic: boolean;
    tags: string[];
    logoUrl?: string | null;
    bannerUrl?: string | null;
    discordUrl?: string | null;
    websiteUrl?: string | null;
    reviewDate?: Date | null;
    expiryDate?: Date | null;
    autoRenew?: boolean;
    settings: FederationSettings;
}
export interface FederationMemberData {
    id: string;
    organizationId: string;
    organizationName: string;
    role: FederationRole;
    joinedAt: Date;
    status: 'active' | 'pending' | 'suspended';
    associationType: FederationAssociationType;
    votingPower: number;
    contributions: number;
}
export interface FederationProposalData {
    id: string;
    federationId: string;
    type: 'add_member' | 'remove_member' | 'amend_governance' | 'add_treaty' | 'declare_war' | 'dissolve' | 'custom';
    title: string;
    description: string;
    proposedBy: string;
    proposedByOrg: string;
    createdAt: Date;
    votingEndsAt: Date;
    votes: FederationVote[];
    status: 'open' | 'passed' | 'rejected' | 'expired';
    requiredApproval: number;
    metadata?: Record<string, unknown> | null;
}
//# sourceMappingURL=OrganizationFederationService.types.d.ts.map