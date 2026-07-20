"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const missionController_1 = require("../../controllers/missionController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const AIUsageTracking_1 = require("../../models/AIUsageTracking");
const schemas_1 = require("../../schemas");
const aiGenerationSchemas_1 = require("../../schemas/aiGenerationSchemas");
const AIBriefingGenerationService_1 = require("../../services/content/AIBriefingGenerationService");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.use(tenantContext_1.tenantContextMiddleware);
let missionController;
const getController = () => {
    if (!missionController) {
        missionController = new missionController_1.MissionController();
    }
    return missionController;
};
let aiService;
const getAIService = () => {
    if (!aiService) {
        aiService = new AIBriefingGenerationService_1.AIBriefingGenerationService();
    }
    return aiService;
};
router.get('/templates', (req, res) => getController().getTemplates(req, res));
router.get('/active', (req, res) => getController().getActiveMissions(req, res));
router.get('/scmdb/cards', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.scmdbSearchQuery, 'query'), (req, res) => getController().searchScmdbMissionCards(req, res));
router.post('/scmdb/import', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.importScmdbMissions, 'body'), (req, res) => getController().importScmdbMissions(req, res));
router.get('/scmdb/filters', (req, res) => getController().getScmdbFilters(req, res));
router.post('/scmdb/import-url', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.importScmdbByUrl, 'body'), (req, res) => getController().importScmdbByUrl(req, res));
router.get('/ai/status', (_req, res) => {
    try {
        const service = getAIService();
        res.json({ available: service.isAvailable() });
    }
    catch {
        res.json({ available: false });
    }
});
router.get('/ai/usage', async (req, res) => {
    try {
        const authReq = req;
        const organizationId = authReq.user?.currentOrganizationId;
        if (!organizationId) {
            res.status(400).json({ error: 'Organization context required' });
            return;
        }
        const stats = await getAIService().getUsageStats(organizationId, AIUsageTracking_1.AIFeatureType.BRIEFING_GENERATION);
        res.json(stats);
    }
    catch (error) {
        const status = error.status || 500;
        logger_1.logger.error('Failed to get AI usage stats', {
            error: error instanceof Error ? error.message : String(error),
        });
        res.status(status).json({ error: error.message || 'Failed to get AI usage stats' });
    }
});
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.create, 'body'), (req, res) => getController().createMission(req, res));
router.get('/', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.query, 'query'), (req, res) => getController().getAllMissions(req, res));
router.get('/:missionId', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (req, res) => getController().getMission(req, res));
router.put('/:missionId', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.update, 'body'), (req, res) => getController().updateMission(req, res));
router.delete('/:missionId', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (req, res) => getController().deleteMission(req, res));
router.put('/:missionId/status', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.updateStatus, 'body'), (req, res) => getController().updateStatus(req, res));
router.get('/:missionId/workflow', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (req, res) => getController().getWorkflow(req, res));
router.post('/:missionId/workflow/advance', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.advanceWorkflow, 'body'), (req, res) => getController().advanceWorkflowPhase(req, res));
router.post('/:missionId/assign', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.assign, 'body'), (req, res) => getController().assignMission(req, res));
router.post('/:missionId/complete', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.complete, 'body'), (req, res) => getController().completeMission(req, res));
router.get('/:missionId/participants', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (req, res) => getController().getParticipants(req, res));
router.post('/:missionId/participants', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.addParticipant, 'body'), (req, res) => getController().addParticipant(req, res));
router.delete('/:missionId/participants/:userId', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.participantIdParam, 'params'), (req, res) => getController().removeParticipant(req, res));
router.post('/:missionId/objectives', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.addObjective, 'body'), (req, res) => getController().addObjective(req, res));
router.put('/:missionId/objectives/:objectiveId', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.objectiveIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.updateObjective, 'body'), (req, res) => getController().updateObjective(req, res));
router.delete('/:missionId/objectives/:objectiveId', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.objectiveIdParam, 'params'), (req, res) => getController().removeObjective(req, res));
router.post('/:missionId/generate-briefing', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(aiGenerationSchemas_1.aiGenerationSchemas.generateBriefing, 'body'), (req, res) => getController().generateBriefing(req, res));
router.post('/:missionId/generate-briefing-stream', (0, schemaValidation_1.validateSchema)(schemas_1.missionSchemas.idParam, 'params'), (0, schemaValidation_1.validateSchema)(aiGenerationSchemas_1.aiGenerationSchemas.generateBriefingStream, 'body'), (req, res) => getController().generateBriefingStream(req, res));
//# sourceMappingURL=missions.js.map