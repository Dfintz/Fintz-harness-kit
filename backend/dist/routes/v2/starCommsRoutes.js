"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const starCommsV2Controller_1 = require("../../controllers/v2/starCommsV2Controller");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const starCommsSchemas_1 = require("../../schemas/starCommsSchemas");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new starCommsV2Controller_1.StarCommsV2Controller();
router.use(auth_1.authenticate);
router.get('/starcomms/accessible', controller.listAccessible);
router.get('/federations/:federationId/starcomms/config', (0, schemaValidation_1.validateSchema)(starCommsSchemas_1.starCommsSchemas.federationIdParam, 'params'), controller.getFederationConfig);
router.put('/federations/:federationId/starcomms/config', (0, schemaValidation_1.validateSchema)(starCommsSchemas_1.starCommsSchemas.federationIdParam, 'params'), (0, schemaValidation_1.validateSchema)(starCommsSchemas_1.starCommsSchemas.updateFederationConfigBody, 'body'), controller.updateFederationConfig);
router.get('/federations/:federationId/starcomms/sharing/suggestions', (0, schemaValidation_1.validateSchema)(starCommsSchemas_1.starCommsSchemas.federationIdParam, 'params'), controller.getFederationSharingSuggestions);
//# sourceMappingURL=starCommsRoutes.js.map