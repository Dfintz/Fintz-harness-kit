"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const eventConflictController_1 = require("../../controllers/v2/eventConflictController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new eventConflictController_1.EventConflictControllerV2();
const orgScoped = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.post('/events/conflicts/check', [...orgScoped, (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.checkConflictsBody, 'body')], controller.checkConflicts.bind(controller));
router.get('/events/conflicts/me', [...orgScoped, (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.myConflictsQuery, 'query')], controller.getMyConflicts.bind(controller));
router.get('/events/conflicts/activity/:activityId', [
    ...orgScoped,
    (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.activityIdParam, 'params'),
    (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.activityConflictsQuery, 'query'),
], controller.getActivityConflicts.bind(controller));
router.get('/events/conflicts/user/:userId', [
    ...orgScoped,
    (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.userIdParam, 'params'),
    (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.userConflictsQuery, 'query'),
], controller.getUserConflicts.bind(controller));
router.get('/events/conflicts/range', [...orgScoped, (0, schemaValidation_1.validateSchema)(schemas_1.eventConflictV2QuerySchemas.rangeQuery, 'query')], controller.getConflictsInRange.bind(controller));
//# sourceMappingURL=eventConflicts.js.map