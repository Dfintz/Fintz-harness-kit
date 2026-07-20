"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const matchmakingController_1 = require("../controllers/matchmakingController");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = express_1.default.Router();
exports.router = router;
router.get('/enums', auth_1.authenticateToken, (req, res) => matchmakingController_1.matchmakingController.getEnums(req, res));
router.get('/preferences', auth_1.authenticateToken, (req, res) => matchmakingController_1.matchmakingController.getPreferences(req, res));
router.post('/preferences', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.socialSchemas.setPreferences, 'body'), (req, res) => matchmakingController_1.matchmakingController.setPreferences(req, res));
router.get('/find', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.socialSchemas.findMatchesQuery, 'query'), (req, res) => matchmakingController_1.matchmakingController.findMatches(req, res));
router.post('/track', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.socialSchemas.trackJoin, 'body'), (req, res) => matchmakingController_1.matchmakingController.trackJoin(req, res));
router.get('/analytics', auth_1.authenticateToken, (req, res) => matchmakingController_1.matchmakingController.getAnalytics(req, res));
//# sourceMappingURL=matchmakingRoutes.js.map