import type { VoiceServerWhitelistSuggestion } from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';
import { ExternalIntegration } from '../../../models/ExternalIntegration';
import { Federation } from '../../../models/Federation';
import { FederationMember } from '../../../models/FederationMember';
import { Organization } from '../../../models/Organization';
import { ExternalIntegrationService } from '../../external/ExternalIntegrationService';
type StarCommsSettings = {
    fleetId?: string;
    name?: string;
    enabled?: boolean;
    status?: ExternalIntegration['status'];
    starCommsConfig?: ExternalIntegration['starCommsConfig'];
};
export declare class StarCommsFederationService {
    private readonly fedRepo;
    private readonly fedMemberRepo;
    private readonly orgRepo;
    private readonly integrationRepo;
    private readonly integrationService;
    constructor(fedRepo?: Repository<Federation>, fedMemberRepo?: Repository<FederationMember>, orgRepo?: Repository<Organization>, integrationRepo?: Repository<ExternalIntegration>, integrationService?: ExternalIntegrationService);
    getFederationConfig(federationId: string): Promise<ExternalIntegration | null>;
    updateFederationConfig(federationId: string, actorOrganizationId: string, actorUserId: string, input: StarCommsSettings): Promise<ExternalIntegration>;
    getFederationWhitelistSuggestions(federationId: string): Promise<VoiceServerWhitelistSuggestion[]>;
    private ensureFederationExists;
    private ensureFederationMembership;
}
export {};
//# sourceMappingURL=StarCommsFederationService.d.ts.map