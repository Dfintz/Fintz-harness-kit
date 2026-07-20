"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const matchmakingController_1 = require("../../controllers/matchmakingController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const socialSchemas_1 = require("../../schemas/socialSchemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
router.get('/enums', (req, res) => matchmakingController_1.matchmakingController.getEnums(req, res));
router.get('/preferences', (req, res) => matchmakingController_1.matchmakingController.getPreferences(req, res));
router.post('/preferences', (0, schemaValidation_1.validateSchema)(socialSchemas_1.socialSchemas.setPreferences, 'body'), (req, res) => matchmakingController_1.matchmakingController.setPreferences(req, res));
router.get('/find', (0, schemaValidation_1.validateSchema)(schemas_1.matchmakingQuerySchemas.findMatchesQuery, 'query'), (req, res) => matchmakingController_1.matchmakingController.findMatches(req, res));
router.post('/track', (0, schemaValidation_1.validateSchema)(schemas_1.matchmakingQuerySchemas.joinSoloQueueBody, 'body'), (req, res) => matchmakingController_1.matchmakingController.trackJoin(req, res));
router.get('/analytics', (req, res) => matchmakingController_1.matchmakingController.getAnalytics(req, res));
//# sourceMappingURL=matchmaking.js.map