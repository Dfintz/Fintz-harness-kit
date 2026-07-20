"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const equipmentController_1 = require("../../controllers/v2/equipmentController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const equipmentSchemas_1 = require("../../schemas/equipmentSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let equipmentController;
const getController = () => {
    if (!equipmentController) {
        equipmentController = new equipmentController_1.EquipmentController();
    }
    return equipmentController;
};
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/user/:userId', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.userParam, 'params'), (req, res) => getController().getUserInventory(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.query, 'query'), (req, res) => getController().list(req, res));
router.post('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.create, 'body'), (req, res) => getController().create(req, res));
router.get('/:equipmentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.param, 'params'), (req, res) => getController().getById(req, res));
router.put('/:equipmentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.update, 'body'), (req, res) => getController().update(req, res));
router.delete('/:equipmentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.param, 'params'), (req, res) => getController().delete(req, res));
router.get('/:equipmentId/compatibility', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.compatibilityQuery, 'query'), (req, res) => getController().checkCompatibility(req, res));
router.post('/:equipmentId/transfer', ...orgAuth, (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.param, 'params'), (0, schemaValidation_1.validateSchema)(equipmentSchemas_1.equipmentSchemas.transfer, 'body'), (req, res) => getController().transfer(req, res));
//# sourceMappingURL=equipment.js.map