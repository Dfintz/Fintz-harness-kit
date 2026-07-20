"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const relationshipController_1 = require("../../controllers/relationshipController");
const auth_1 = require("../../middleware/auth");
const relationshipValidation_1 = require("../../middleware/relationshipValidation");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
const orgAuth = [tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
let relationshipController;
const getController = () => {
    if (!relationshipController) {
        relationshipController = new relationshipController_1.RelationshipController();
    }
    return relationshipController;
};
router.get('/types', (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.typesQuery, 'query'), (req, res) => getController().getRelationshipTypes(req, res));
router.get('/change-types', (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.changeTypesQuery, 'query'), (req, res) => getController().getChangeTypes(req, res));
router.get('/sentiments', (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.sentimentsQuery, 'query'), (req, res) => getController().getInteractionSentiments(req, res));
router.post('/', ...orgAuth, relationshipValidation_1.validateCreateRelationship, (req, res) => getController().createRelationship(req, res));
router.get('/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), (req, res) => getController().getRelationship(req, res));
router.put('/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), relationshipValidation_1.validateUpdateRelationship, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.updateBody, 'body'), (req, res) => getController().updateRelationship(req, res));
router.delete('/:id', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), relationshipValidation_1.validateTerminateRelationship, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.terminateBody, 'body'), (req, res) => getController().terminateRelationship(req, res));
router.get('/:id/history', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.historyQuery, 'query'), (req, res) => getController().getRelationshipHistory(req, res));
router.get('/:id/timeline', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.timelineQuery, 'query'), (req, res) => getController().getRelationshipTimeline(req, res));
router.get('/:id/analytics', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.analyticsQuery, 'query'), (req, res) => getController().getRelationshipAnalytics(req, res));
router.get('/:id/sentiment-trend', ...orgAuth, (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.idParam, 'params'), (0, relationshipValidation_1.validateUUID)('id'), (0, schemaValidation_1.validateSchema)(schemas_1.relationshipV2QuerySchemas.sentimentTrendQuery, 'query'), (req, res) => getController().getSentimentTrend(req, res));
router.post('/:id/interactions', ...orgAuth, (0, relationshipValidation_1.validateUUID)('id'), relationshipValidation_1.validateRecordInteraction, (req, res) => getController().recordInteraction(req, res));
router.post('/:id/trust', ...orgAuth, (0, relationshipValidation_1.validateUUID)('id'), relationshipValidation_1.validateUpdateTrustScore, (req, res) => getController().updateTrustScore(req, res));
router.get('/:id/trust/history', ...orgAuth, (0, relationshipValidation_1.validateUUID)('id'), (req, res) => getController().getTrustHistory(req, res));
router.get('/:id/trust/recommendations', ...orgAuth, (0, relationshipValidation_1.validateUUID)('id'), (req, res) => getController().getTrustRecommendations(req, res));
router.post('/:id/mutual', ...orgAuth, (0, relationshipValidation_1.validateUUID)('id'), (req, res) => getController().establishMutualRelationship(req, res));
router.get('/organizations/:orgId/relationships', ...orgAuth, (0, relationshipValidation_1.validateUUID)('orgId'), (req, res) => getController().getOrganizationRelationships(req, res));
router.get('/organizations/:orgId/relationships/health', ...orgAuth, (0, relationshipValidation_1.validateUUID)('orgId'), (req, res) => getController().getRelationshipHealthSummary(req, res));
router.get('/organizations/:orgId/relationships/review', ...orgAuth, (0, relationshipValidation_1.validateUUID)('orgId'), (req, res) => getController().getRelationshipsNeedingReview(req, res));
//# sourceMappingURL=relationships.js.map