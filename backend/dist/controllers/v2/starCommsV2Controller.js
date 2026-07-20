"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarCommsV2Controller = void 0;
const data_source_1 = require("../../data-source");
const FederationMember_1 = require("../../models/FederationMember");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const starcomms_1 = require("../../services/communication/starcomms");
const apiErrors_1 = require("../../utils/apiErrors");
const prototypePollutionPrevention_1 = require("../../utils/prototypePollutionPrevention");
const BaseController_1 = require("../BaseController");
class StarCommsV2Controller extends BaseController_1.BaseController {
    accessService = new starcomms_1.StarCommsAccessService();
    federationService = new starcomms_1.StarCommsFederationService();
    federationMemberRepo = data_source_1.AppDataSource.getRepository(FederationMember_1.FederationMember);
    membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
    listAccessible = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const userId = this.getUserId(request);
            return this.accessService.listAccessibleIntegrations(userId);
        });
    };
    getFederationConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const federationId = authReq.params.federationId;
            const userId = this.getUserId(authReq);
            await this.ensureUserCanViewFederation(userId, federationId);
            return this.federationService.getFederationConfig(federationId);
        });
    };
    updateFederationConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const federationId = authReq.params.federationId;
            const userId = this.getUserId(authReq);
            const organizationId = this.getOrganizationId(authReq);
            await this.ensureUserCanViewFederation(userId, federationId);
            return this.federationService.updateFederationConfig(federationId, organizationId, userId, (0, prototypePollutionPrevention_1.sanitizeObject)(authReq.body));
        });
    };
    getFederationSharingSuggestions = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const federationId = authReq.params.federationId;
            const userId = this.getUserId(authReq);
            await this.ensureUserCanViewFederation(userId, federationId);
            return this.federationService.getFederationWhitelistSuggestions(federationId);
        });
    };
    async ensureUserCanViewFederation(userId, federationId) {
        const memberships = await this.membershipRepo
            .createQueryBuilder('membership')
            .select(['membership."organizationId"'])
            .where('membership."userId" = :userId', { userId })
            .andWhere('membership."isActive" = true')
            .getMany();
        const organizationIds = memberships
            .map(membership => membership.organizationId)
            .filter((organizationId) => Boolean(organizationId));
        if (organizationIds.length === 0) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this federation StarComms configuration');
        }
        const federationMembership = await this.federationMemberRepo
            .createQueryBuilder('member')
            .select(['member.id'])
            .where('member."federationId" = :federationId', { federationId })
            .andWhere('member."organizationId" = ANY(:organizationIds)', { organizationIds })
            .andWhere('member.status = :status', { status: 'active' })
            .getOne();
        if (!federationMembership) {
            throw new apiErrors_1.ForbiddenError('You do not have access to this federation StarComms configuration');
        }
    }
    getUserId(req) {
        const userId = req.user?.id;
        if (!userId) {
            throw new apiErrors_1.ForbiddenError('Authentication required');
        }
        return userId;
    }
}
exports.StarCommsV2Controller = StarCommsV2Controller;
//# sourceMappingURL=starCommsV2Controller.js.map