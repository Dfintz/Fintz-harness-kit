"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const secretsController_1 = require("../controllers/secretsController");
const auth_1 = require("../middleware/auth");
const authorization_1 = require("../middleware/authorization");
const router = express_1.default.Router();
exports.router = router;
let secretsController;
const getController = () => {
    if (!secretsController) {
        secretsController = new secretsController_1.SecretsController();
    }
    return secretsController;
};
router.get('/status', auth_1.authenticateToken, authorization_1.requireAdmin, (req, res) => getController().getSecretsStatus(req, res));
router.get('/rotation-check', auth_1.authenticateToken, authorization_1.requireAdmin, (req, res) => getController().checkSecretsRotation(req, res));
router.post('/rotate-jwt', auth_1.authenticateToken, authorization_1.requireAdmin, (req, res) => getController().rotateJwtSecret(req, res));
router.post('/rotate-encryption-key', auth_1.authenticateToken, authorization_1.requireAdmin, (req, res) => getController().rotateEncryptionKey(req, res));
router.post('/rotate-db-password', auth_1.authenticateToken, authorization_1.requireAdmin, (req, res) => getController().rotateDbPassword(req, res));
router.post('/reload', auth_1.authenticateToken, authorization_1.requireAdmin, (req, res) => getController().reloadSecrets(req, res));
//# sourceMappingURL=secretsRoutes.js.map