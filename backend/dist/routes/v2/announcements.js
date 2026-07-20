"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const announcementController_1 = require("../../controllers/v2/announcementController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const announcementSchemas_1 = require("../../schemas/announcementSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let announcementController;
const getController = () => {
    if (!announcementController) {
        announcementController = new announcementController_1.AnnouncementController();
    }
    return announcementController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(announcementSchemas_1.announcementSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(announcementSchemas_1.announcementSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:announcementId', ...orgAuth, (req, res) => getController().getById(req, res));
router.put('/:announcementId', ...orgAuth, (0, schemaValidation_1.validateSchema)(announcementSchemas_1.announcementSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:announcementId', ...orgAuth, (req, res) => getController().delete(req, res));
router.post('/:announcementId/publish', ...orgAuth, (0, schemaValidation_1.validateSchema)(announcementSchemas_1.announcementSchemas.send, 'body'), (req, res) => getController().publish(req, res));
router.post('/:announcementId/pin', ...orgAuth, (req, res) => getController().pin(req, res));
router.post('/:announcementId/read', ...orgAuth, (req, res) => getController().markRead(req, res));
//# sourceMappingURL=announcements.js.map