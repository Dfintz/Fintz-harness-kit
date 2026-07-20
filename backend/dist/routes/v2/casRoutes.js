"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.casRoutes = void 0;
const express_1 = require("express");
const CASController_1 = require("../../controllers/v2/CASController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const casSchemas_1 = require("../../schemas/casSchemas");
const router = (0, express_1.Router)();
exports.casRoutes = router;
const controller = new CASController_1.CASController();
router.get('/organizations/:orgId/cas/score', auth_1.authenticate, controller.getScore.bind(controller));
router.get('/organizations/:orgId/cas/history', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(casSchemas_1.casSchemas.getHistory, 'query'), controller.getHistory.bind(controller));
router.get('/organizations/:orgId/cas/breakdown', auth_1.authenticate, controller.getBreakdown.bind(controller));
router.get('/organizations/:orgId/cas/heatmap', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(casSchemas_1.casSchemas.getHeatmap, 'query'), controller.getHeatmap.bind(controller));
router.get('/cas/ranking', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(casSchemas_1.casSchemas.getRanking, 'query'), controller.getRanking.bind(controller));
//# sourceMappingURL=casRoutes.js.map