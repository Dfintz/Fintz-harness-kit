import type { FederationAssociationType, FederationMemberStatus, FederationRole } from '@sc-fleet-manager/shared-types';
import { Federation } from './Federation';
export declare class FederationMember {
    id: string;
    federationId: string;
    federation?: Federation;
    organizationId: string;
    organizationName: string;
    role: FederationRole;
    status: FederationMemberStatus;
    associationType: FederationAssociationType;
    votingPower: number;
    contributions: number;
    joinedAt: Date;
}
//# sourceMappingURL=FederationMember.d.ts.map