import { Repository } from 'typeorm';
import { ExternalIntegration } from '../../../models/ExternalIntegration';
import { FederationMember } from '../../../models/FederationMember';
import { Fleet } from '../../../models/Fleet';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import { User } from '../../../models/User';
import { PermissionManagerService } from '../../security/permissions/PermissionManagerService';
type StarCommsAccessSource = 'owned' | 'shared' | 'public' | 'discord-manager';
type AccessibleStarCommsIntegration = ExternalIntegration & {
    accessSource?: StarCommsAccessSource;
};
export declare class StarCommsAccessService {
    private readonly integrationRepo;
    private readonly membershipRepo;
    private readonly federationMemberRepo;
    private readonly fleetRepo;
    private readonly userRepo;
    private readonly permissionManager;
    constructor(integrationRepo?: Repository<ExternalIntegration>, membershipRepo?: Repository<OrganizationMembership>, federationMemberRepo?: Repository<FederationMember>, fleetRepo?: Repository<Fleet>, userRepo?: Repository<User>, permissionManager?: PermissionManagerService);
    listAccessibleIntegrations(userId: string): Promise<AccessibleStarCommsIntegration[]>;
    ensureIntegrationAccess(userId: string, currentOrganizationId: string, integration: ExternalIntegration): Promise<void>;
    private loadDiscordUserId;
    private loadUserOrgIds;
    private loadUserFederationIds;
    private normalizeOwnerType;
    private resolveAccessSource;
    private resolveFleetAccessSource;
    private resolveOrganizationAccessSource;
    private resolveFederationAccessSource;
    private isPublicIntegration;
    private hasDiscordManagerAccessForOrganization;
    private hasDiscordManagerAccessForFederation;
    private hasDiscordManagerAccessForGuildSettings;
    private whitelistMatches;
    private resolvePolicyOrganizationId;
    private verifyPolicyConstraints;
    private parsePermissionKey;
}
export {};
//# sourceMappingURL=StarCommsAccessService.d.ts.map