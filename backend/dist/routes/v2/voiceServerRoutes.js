"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.voiceServerRouter = void 0;
const express_1 = require("express");
const VoiceServerController_1 = require("../../controllers/v2/VoiceServerController");
const data_source_1 = require("../../data-source");
const auth_1 = require("../../middleware/auth");
const internalServiceAuth_1 = require("../../middleware/internalServiceAuth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const voiceServerSchemas_1 = require("../../schemas/voiceServerSchemas");
const logger_1 = require("../../utils/logger");
const roleUtils_1 = require("../../utils/roleUtils");
const router = (0, express_1.Router)();
exports.voiceServerRouter = router;
const controller = new VoiceServerController_1.VoiceServerController();
const membershipRepo = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
async function resolveOrgVoiceWriteRoleContext(userId, targetOrgId) {
    if (!userId || !targetOrgId) {
        return {
            resolvedRole: undefined,
            membershipRole: undefined,
            usedMembershipLookup: false,
        };
    }
    const membership = await membershipRepo.findOne({
        where: { userId, organizationId: targetOrgId, isActive: true },
        relations: ['role'],
    });
    const membershipRole = (0, roleUtils_1.getRoleName)(membership?.role) || undefined;
    return {
        resolvedRole: membershipRole,
        membershipRole,
        usedMembershipLookup: true,
    };
}
const ORG_VOICE_WRITE_ROLES = ['founder', 'owner', 'admin'];
const VOICE_SERVER_WRITE_MESSAGE = 'Only organization founders, owners, and admins can manage voice server settings';
const orgRead = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
const orgWrite = [
    auth_1.authenticate,
    tenantContext_1.tenantContextMiddleware,
    tenantContext_1.requireTenantContext,
    async (req, res, next) => {
        const targetOrgId = req.params.orgId;
        const activeOrgId = req.tenantContext?.organizationId;
        const tenantContextRole = req.tenantContext?.organizationRole;
        const { resolvedRole, membershipRole, usedMembershipLookup } = await resolveOrgVoiceWriteRoleContext(req.user?.id, targetOrgId);
        if (!resolvedRole || !ORG_VOICE_WRITE_ROLES.includes(resolvedRole)) {
            logger_1.logger.warn('Denied organization voice server write', {
                userId: req.user?.id,
                targetOrgId,
                activeOrgId,
                tenantContextOrganizationRole: tenantContextRole,
                requestedOrganizationRole: membershipRole,
                resolvedOrganizationRole: resolvedRole,
                usedMembershipLookup,
                path: req.path,
                method: req.method,
            });
            res.status(403).json({
                error: 'Insufficient permissions',
                message: VOICE_SERVER_WRITE_MESSAGE,
                required: ORG_VOICE_WRITE_ROLES,
                current: resolvedRole,
            });
            return;
        }
        next();
    },
];
router.get('/organizations/:orgId/voice-server/config', ...orgRead, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerOrgParamsSchema, 'params'), controller.getOrgConfig);
router.get('/organizations/:orgId/voice-server/status', ...orgRead, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerOrgParamsSchema, 'params'), controller.getOrgStatus);
router.get('/organizations/:orgId/voice-server/stats', ...orgRead, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerOrgParamsSchema, 'params'), (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerStatsQuerySchema, 'query'), controller.getOrgStats);
router.put('/organizations/:orgId/voice-server/config', (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerOrgParamsSchema, 'params'), ...orgWrite, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerConfigSchema, 'body'), controller.updateOrgConfig);
router.delete('/organizations/:orgId/voice-server/config', (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerOrgParamsSchema, 'params'), ...orgWrite, controller.deleteOrgConfig);
router.get('/organizations/:orgId/voice-server/sharing/suggestions', (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerOrgParamsSchema, 'params'), ...orgWrite, controller.getOrgWhitelistSuggestions);
router.get('/federations/:federationId/voice-server/config', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerFedParamsSchema, 'params'), controller.getFedConfig);
router.get('/federations/:federationId/voice-server/status', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerFedParamsSchema, 'params'), controller.getFedStatus);
router.get('/federations/:federationId/voice-server/stats', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerFedParamsSchema, 'params'), (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerStatsQuerySchema, 'query'), controller.getFedStats);
router.put('/federations/:federationId/voice-server/config', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerFedParamsSchema, 'params'), (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerConfigSchema, 'body'), controller.updateFedConfig);
router.delete('/federations/:federationId/voice-server/config', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerFedParamsSchema, 'params'), controller.deleteFedConfig);
router.get('/federations/:federationId/voice-server/sharing/suggestions', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceServerFedParamsSchema, 'params'), controller.getFedWhitelistSuggestions);
router.get('/voice-server/accessible', auth_1.authenticate, controller.listAccessible);
router.get('/voice/org-lookup', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.rsiSidLookupSchema, 'query'), controller.lookupOrgByRsiSid);
router.get('/voice/federations-with-relationships', auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext, controller.getPositiveRelationshipFederations);
router.post('/voice-server/platform/channel-data', internalServiceAuth_1.internalServiceAuthRequired, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceChannelDataSchema, 'body'), controller.updatePlatformChannelData);
router.post('/voice-server/auth/token', auth_1.authenticate, controller.generateVoiceToken);
router.post('/voice-server/auth/validate', internalServiceAuth_1.internalServiceAuthRequired, (0, schemaValidation_1.validateSchema)(voiceServerSchemas_1.voiceTokenValidateSchema, 'body'), controller.validateVoiceToken);
//# sourceMappingURL=voiceServerRoutes.js.map