"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const notificationController_1 = require("../../controllers/notificationController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(auth_1.authenticate);
let notificationController;
const getController = () => {
    if (!notificationController) {
        notificationController = new notificationController_1.NotificationController();
    }
    return notificationController;
};
router.get('/', (req, res) => getController().listNotifications(req, res));
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.communicationSchemas.createNotification, 'body'), (req, res) => getController().sendNotification(req, res));
router.post('/mark-read', (0, schemaValidation_1.validateSchema)(schemas_1.communicationSchemas.markAsRead, 'body'), (req, res) => getController().markAsRead(req, res));
router.post('/mark-all-read', (req, res) => getController().markAllAsRead(req, res));
router.get('/digest', (req, res) => getController().getDigest(req, res));
router.delete('/:notificationId', (0, schemaValidation_1.validateSchema)(schemas_1.communicationSchemas.notificationParam, 'params'), (req, res) => getController().deleteNotification(req, res));
router.get('/preferences/user', (req, res) => getController().getPreferences(req, res));
router.put('/preferences/user', (req, res) => getController().updatePreferences(req, res));
//# sourceMappingURL=notifications.js.map