"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const certificationController_1 = require("../../controllers/v2/certificationController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const certificationSchemas_1 = require("../../schemas/certificationSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let certificationController;
const getController = () => {
    if (!certificationController) {
        certificationController = new certificationController_1.CertificationController();
    }
    return certificationController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/user/:userId', ...orgAuth, (req, res) => getController().getUserCertifications(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.query, 'query'), (req, res) => getController().listCertifications(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.create, 'body'), (req, res) => getController().createCertification(req, res));
router.get('/:certificationId', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.param, 'params'), (req, res) => getController().getCertification(req, res));
router.put('/:certificationId', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.update, 'body'), (req, res) => getController().updateCertification(req, res));
router.delete('/:certificationId', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.param, 'params'), (req, res) => getController().deleteCertification(req, res));
router.post('/:certificationId/award', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.award, 'body'), (req, res) => getController().awardCertification(req, res));
router.post('/:certificationId/revoke', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.revoke, 'body'), (req, res) => getController().revokeCertification(req, res));
router.get('/:certificationId/holders', ...orgAuth, (0, schemaValidation_1.validateSchema)(certificationSchemas_1.certificationSchemas.param, 'params'), (req, res) => getController().getCertificationHolders(req, res));
//# sourceMappingURL=certifications.js.map