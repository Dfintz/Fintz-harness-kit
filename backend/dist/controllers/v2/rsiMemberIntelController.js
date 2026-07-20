"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RsiMemberIntelController = void 0;
const RsiMemberIntelService_1 = require("../../services/external/RsiMemberIntelService");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const BaseController_1 = require("../BaseController");
class RsiMemberIntelController extends BaseController_1.BaseController {
    intelService;
    constructor() {
        super();
        this.intelService = RsiMemberIntelService_1.rsiMemberIntelService;
    }
    listMembers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId;
            const result = await this.intelService.getMemberList(organizationId);
            return { members: result.members, count: result.members.length, status: result.status };
        });
    };
    getMemberCard = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, rsiHandle } = req.params;
            const card = await this.intelService.getMemberCard(orgId, rsiHandle);
            if (!card) {
                throw new apiErrors_1.NotFoundError('Member not found in RSI org data');
            }
            return card;
        });
    };
    enrichMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, rsiHandle } = req.params;
            logger_1.logger.info('Manual member enrichment triggered', {
                organizationId: orgId,
                rsiHandle,
                triggeredBy: req.user?.id,
            });
            return this.intelService.enrichMember(orgId, rsiHandle);
        });
    };
    enrichAll = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId;
            logger_1.logger.info('Batch member enrichment triggered', {
                organizationId,
                triggeredBy: req.user?.id,
            });
            return this.intelService.enrichOrganizationMembers(organizationId);
        });
    };
    runAudit = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId;
            const guildId = req.body?.guildId;
            logger_1.logger.info('Member audit triggered', {
                organizationId,
                guildId,
                triggeredBy: req.user?.id,
            });
            return this.intelService.runMemberAudit(organizationId, guildId);
        });
    };
    validateRoles = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId;
            const guildId = req.body?.guildId;
            logger_1.logger.info('Role mapping validation triggered', {
                organizationId,
                guildId,
                triggeredBy: req.user?.id,
            });
            return this.intelService.validateRoleMappings(organizationId, guildId);
        });
    };
    suggestLinkCandidates = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId;
            const query = typeof req.query.q === 'string' ? req.query.q : undefined;
            return this.intelService.suggestLinkCandidates(organizationId, query);
        });
    };
    manualLink = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, rsiHandle } = req.params;
            const body = req.body;
            const performedBy = req.user?.id ?? 'unknown';
            logger_1.logger.info('Manual RSI link requested', {
                organizationId: orgId,
                rsiHandle,
                targetUserId: body.userId,
                triggeredBy: performedBy,
            });
            return this.intelService.manualLink(orgId, rsiHandle, body, performedBy);
        });
    };
    unlinkMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, rsiHandle } = req.params;
            const performedBy = req.user?.id ?? 'unknown';
            logger_1.logger.info('Manual RSI unlink requested', {
                organizationId: orgId,
                rsiHandle,
                triggeredBy: performedBy,
            });
            return this.intelService.unlinkMember(orgId, rsiHandle, performedBy);
        });
    };
    clearCache = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId;
            const performedBy = req.user?.id ?? 'unknown';
            logger_1.logger.info('RSI cache clear requested', {
                organizationId,
                triggeredBy: performedBy,
            });
            return this.intelService.clearCache(organizationId, performedBy);
        });
    };
}
exports.RsiMemberIntelController = RsiMemberIntelController;
//# sourceMappingURL=rsiMemberIntelController.js.map