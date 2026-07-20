"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const FeatureFlagController_1 = require("../controllers/FeatureFlagController");
const adminAuth_1 = require("../middleware/adminAuth");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const featureFlagSchemas_1 = require("../schemas/featureFlagSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let featureFlagController;
const getController = () => {
    if (!featureFlagController) {
        featureFlagController = new FeatureFlagController_1.FeatureFlagController();
    }
    return featureFlagController;
};
router.get('/evaluate/:flagId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.paramSchemas.flagId, 'params'), (req, res) => getController().evaluateFlag(req, res));
router.post('/evaluate-batch', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.featureFlagSchemas.evaluateBatch, 'body'), (req, res) => getController().evaluateBatch(req, res));
router.get('/enabled', auth_1.authenticate, (req, res) => getController().getEnabledFlags(req, res));
router.get('/:id/analytics', auth_1.authenticate, adminAuth_1.requireAdmin, (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.paramSchemas.featureFlagId, 'params'), (0, schemaValidation_1.validateSchema)(featureFlagSchemas_1.featureFlagSchemas.analyticsQuery, 'query'), (req, res) => getController().getAnalytics(req, res));
//# sourceMappingURL=featureFlagRoutes.js.map