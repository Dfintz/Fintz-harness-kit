import type { FederationGovernance, FederationSettings, FederationStatus, FederationTreaty, SharedResource } from '@sc-fleet-manager/shared-types';
import { FederationMember } from './FederationMember';
import { FederationProposal } from './FederationProposal';
export declare class Federation {
    id: string;
    name: string;
    description: string;
    founderId: string;
    founderOrgId: string;
    governance: FederationGovernance;
    sharedResources: SharedResource[];
    treaties: FederationTreaty[];
    status: FederationStatus;
    isPublic: boolean;
    tags: string[];
    logoUrl: string | null;
    bannerUrl: string | null;
    discordUrl: string | null;
    websiteUrl: string | null;
    reviewDate: Date | null;
    expiryDate: Date | null;
    autoRenew: boolean;
    settings: FederationSettings;
    members?: FederationMember[];
    proposals?: FederationProposal[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=Federation.d.ts.map