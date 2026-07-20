import type { FederationVote, ProposalStatus, ProposalType } from '@sc-fleet-manager/shared-types';
import { Federation } from './Federation';
export declare class FederationProposal {
    id: string;
    federationId: string;
    federation?: Federation;
    type: ProposalType;
    title: string;
    description: string;
    proposedBy: string;
    proposedByOrg: string;
    votes: FederationVote[];
    status: ProposalStatus;
    requiredApproval: number;
    metadata: Record<string, unknown> | null;
    votingEndsAt: Date;
    createdAt: Date;
}
//# sourceMappingURL=FederationProposal.d.ts.map