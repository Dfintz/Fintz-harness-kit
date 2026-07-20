"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const ErrorTrackingController_1 = require("../../controllers/ErrorTrackingController");
const errorHandler_1 = require("../../middleware/errorHandler");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.post('/errors/track', (0, schemaValidation_1.validateSchema)(schemas_1.monitoringSchemas.trackError, 'body'), (0, errorHandler_1.asyncHandler)(ErrorTrackingController_1.trackFrontendError));
//# sourceMappingURL=errors.js.map