"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceServerController = void 0;
const VoiceAuthService_1 = require("../../services/communication/voice/VoiceAuthService");
const VoiceServerService_1 = require("../../services/communication/voice/VoiceServerService");
const apiErrors_1 = require("../../utils/apiErrors");
const prototypePollutionPrevention_1 = require("../../utils/prototypePollutionPrevention");
const BaseController_1 = require("../BaseController");
class VoiceServerController extends BaseController_1.BaseController {
    voiceService = VoiceServerService_1.VoiceServerService.getInstance();
    getOrgConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getOrgVoiceConfigForUser(authReq.params.orgId, userId);
        });
    };
    getOrgStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getOrgVoiceStatusForUser(authReq.params.orgId, userId);
        });
    };
    getOrgStats = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getOrgVoiceStatsForUser(authReq.params.orgId, userId);
        });
    };
    updateOrgConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.updateOrgVoiceConfig(authReq.params.orgId, userId, (0, prototypePollutionPrevention_1.sanitizeObject)(authReq.body));
        });
    };
    deleteOrgConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            await this.voiceService.deleteOrgVoiceConfig(authReq.params.orgId, userId);
            return { success: true };
        });
    };
    getOrgWhitelistSuggestions = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.voiceService.getWhitelistSuggestions(req.params.orgId));
    };
    getFedConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getFederationVoiceConfigForUser(req.params.federationId, userId);
        });
    };
    getFedStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getFederationVoiceStatusForUser(req.params.federationId, userId);
        });
    };
    getFedStats = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getFederationVoiceStatsForUser(req.params.federationId, userId);
        });
    };
    updateFedConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            const orgId = this.getAuthUser(authReq).currentOrganizationId
                ? this.getOrganizationId(authReq)
                : await this.voiceService.resolveFederationActorOrganizationId(userId, authReq.params.federationId);
            return this.voiceService.updateFedVoiceConfig(authReq.params.federationId, orgId, userId, (0, prototypePollutionPrevention_1.sanitizeObject)(authReq.body));
        });
    };
    deleteFedConfig = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            const orgId = this.getAuthUser(authReq).currentOrganizationId
                ? this.getOrganizationId(authReq)
                : await this.voiceService.resolveFederationActorOrganizationId(userId, authReq.params.federationId);
            await this.voiceService.deleteFedVoiceConfig(authReq.params.federationId, orgId, userId);
            return { success: true };
        });
    };
    getFedWhitelistSuggestions = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.getFederationWhitelistSuggestionsForUser(authReq.params.federationId, userId);
        });
    };
    listAccessible = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const userId = this.getAuthUser(authReq).id;
            return this.voiceService.listAccessibleVoiceServers(userId);
        });
    };
    lookupOrgByRsiSid = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const { rsiSid } = authReq.query;
            const userOrgId = this.getAuthUser(authReq).currentOrganizationId;
            if (!userOrgId) {
                throw new apiErrors_1.ForbiddenError('User has no active organization context');
            }
            return this.voiceService.getOrganizationByRsiSid(rsiSid, userOrgId);
        });
    };
    getPositiveRelationshipFederations = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const user = this.getAuthUser(authReq);
            const userOrgId = user.currentOrganizationId;
            if (!userOrgId) {
                throw new apiErrors_1.ForbiddenError('User has no active organization context');
            }
            return this.voiceService.getFederationsWithPositiveRelationshipsForUser(user.id, userOrgId);
        });
    };
    updatePlatformChannelData = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const rawScope = req.query.scope;
            const ownerScope = typeof rawScope === 'string' && rawScope.length > 0 && rawScope.length <= 128
                ? rawScope
                : 'platform';
            await this.voiceService.cachePlatformChannelData(req.body, ownerScope);
            return { success: true };
        });
    };
    generateVoiceToken = async (req, res) => {
        await this.executeAndReturn(req, res, async (request) => {
            const authReq = request;
            const user = this.getAuthUser(authReq);
            const hasAccess = await this.voiceService.checkPlatformMumbleAccess(user.id);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('You must be a member of the platform federation to access this voice server');
            }
            const connectInfo = await this.voiceService.getPlatformConnectInfo();
            if (!connectInfo.connectUrl) {
                return { error: 'Platform voice server not configured' };
            }
            const authService = VoiceAuthService_1.VoiceAuthService.getInstance();
            return authService.generateToken(user.id, user.username ?? user.id, connectInfo.connectUrl);
        });
    };
    validateVoiceToken = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { token, username } = req.body;
            const authService = VoiceAuthService_1.VoiceAuthService.getInstance();
            return authService.validateToken(token, username);
        });
    };
}
exports.VoiceServerController = VoiceServerController;
//# sourceMappingURL=VoiceServerController.js.map