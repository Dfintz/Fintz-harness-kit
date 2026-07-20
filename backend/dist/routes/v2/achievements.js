"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const achievementController_1 = require("../../controllers/v2/achievementController");
const auth_1 = require("../../middleware/auth");
const relationshipValidation_1 = require("../../middleware/relationshipValidation");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const achievementSchemas_1 = require("../../schemas/achievementSchemas");
const OrganizationSettingsService_1 = require("../../services/organization/OrganizationSettingsService");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
let achievementController;
const getController = () => {
    if (!achievementController) {
        achievementController = new achievementController_1.AchievementController();
    }
    return achievementController;
};
const settingsService = new OrganizationSettingsService_1.OrganizationSettingsService();
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/user/:userId', auth_1.authenticate, (0, relationshipValidation_1.validateUUID)('userId'), (req, res) => getController().getPublicUserItems(req, res));
router.use(...orgAuth, async (req, res, next) => {
    try {
        const organizationId = req.tenantContext?.organizationId;
        if (!organizationId) {
            res
                .status(400)
                .json({ error: { code: 'MISSING_ORG', message: 'Organization context required' } });
            return;
        }
        const settings = await settingsService.getEffectiveSettings(organizationId);
        if (!settings?.enableTitlesBadges) {
            res.status(404).json({
                error: {
                    code: 'FEATURE_DISABLED',
                    message: 'Titles & Badges are not enabled for this organization',
                },
            });
            return;
        }
        next();
    }
    catch (err) {
        logger_1.logger.error('Failed to check titles & badges setting', {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(500).json({
            error: { code: 'INTERNAL_ERROR', message: 'Failed to verify feature availability' },
        });
    }
});
router.get('/user/:userId/org', (req, res) => getController().getUserItems(req, res));
router.get('/', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:achievementId', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.put('/:achievementId', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:achievementId', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.param, 'params'), (req, res) => getController().delete(req, res));
router.post('/:achievementId/award', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.award, 'body'), (req, res) => getController().award(req, res));
router.get('/:achievementId/recipients', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.param, 'params'), (req, res) => getController().getRecipients(req, res));
router.post('/:achievementId/revoke', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.revoke, 'body'), (req, res) => getController().revoke(req, res));
router.patch('/display/:userAchievementId', (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.displayParam, 'params'), (0, schemaValidation_1.validateSchema)(achievementSchemas_1.achievementSchemas.toggleDisplay, 'body'), (req, res) => getController().toggleDisplay(req, res));
//# sourceMappingURL=achievements.js.map