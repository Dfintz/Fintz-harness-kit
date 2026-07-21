/**
 * OrganizationFederationService DTOs and result shapes.
 *
 * Extracted from `OrganizationFederationService.ts` (E5 large-file decomposition) to
 * establish a types/logic ownership boundary on the organization domain's largest
 * service. The service module re-exports every interface below, so all existing
 * `./OrganizationFederationService` and `services/organization` barrel import paths
 * are preserved.
 */
import type {
  FederationAssociationType,
  FederationGovernance,
  FederationRole,
  FederationSettings,
  FederationTreaty,
  FederationVote,
  SharedResource,
} from '@sc-fleet-manager/shared-types';

/**
 * Federation configuration — flattened view combining the Federation entity
 * with its loaded members array. Used as the return type for service methods
 * to maintain backward compatibility with the previous in-memory API.
 */
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

/**
 * Member data structure returned by service methods.
 * Matches the FederationMember entity columns.
 */
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

/**
 * Proposal data structure returned by service methods.
 * Matches the FederationProposal entity columns.
 */
export interface FederationProposalData {
  id: string;
  federationId: string;
  type:
    | 'add_member'
    | 'remove_member'
    | 'amend_governance'
    | 'add_treaty'
    | 'declare_war'
    | 'dissolve'
    | 'custom';
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

