"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = exports.orgRolesRouter = void 0;
const express_1 = require("express");
const rolesController_1 = require("../../controllers/v2/rolesController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const roleSchemas_1 = require("../../schemas/roleSchemas");
const logger_1 = require("../../utils/logger");
const router = (0, express_1.Router)();
exports.router = router;
const controller = new rolesController_1.RolesControllerV2();
router.get('/', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.listQuery, 'query'), (req, res) => controller.listRoles(req, res));
router.post('/', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.create), (req, res) => controller.createRole(req, res));
router.get('/search/by-scope', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.searchByScopeQuery, 'query'), (req, res) => controller.searchByScope(req, res));
router.get('/templates', auth_1.authenticate, (req, res) => controller.getTemplates(req, res));
router.post('/templates/:templateId/apply', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.templateIdParam, 'params'), (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.applyTemplate), (req, res) => controller.applyTemplate(req, res));
router.get('/:roleId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdParam, 'params'), (req, res) => controller.getRole(req, res));
router.put('/:roleId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdParam, 'params'), (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.update), (req, res) => controller.updateRole(req, res));
router.delete('/:roleId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdParam, 'params'), (req, res) => controller.deleteRole(req, res));
router.post('/:roleId/assign', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdParam, 'params'), (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.assign), (req, res) => controller.assignRoleToUser(req, res));
router.delete('/:roleId/assign/:userId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdUserIdParams, 'params'), (req, res) => controller.removeRoleFromUser(req, res));
router.get('/:roleId/permissions', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdParam, 'params'), (req, res) => controller.getRolePermissions(req, res));
router.post('/:roleId/permissions', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdParam, 'params'), (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.addPermission), (req, res) => controller.addPermissionToRole(req, res));
router.delete('/:roleId/permissions/:permissionId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.roleIdPermissionIdParams, 'params'), (req, res) => controller.removePermissionFromRole(req, res));
const orgRolesRouter = (0, express_1.Router)();
exports.orgRolesRouter = orgRolesRouter;
const injectOrgIdToQuery = (req, _res, next) => {
    if (req.params.orgId) {
        req.query.organizationId = req.params.orgId;
    }
    next();
};
const injectOrgIdToBody = (req, _res, next) => {
    if (req.params.orgId) {
        const body = req.body;
        body.organizationId ??= req.params.orgId;
        body.scope = 'organization';
    }
    next();
};
const auditStrippedRoleUpdateFields = (req, _res, next) => {
    const body = (req.body ?? {});
    const stripped = [];
    if ('isSystemRole' in body) {
        stripped.push('isSystemRole');
    }
    if ('organizationId' in body) {
        stripped.push('organizationId');
    }
    if (stripped.length > 0) {
        const userId = req.user?.id ?? 'anonymous';
        logger_1.logger.warn('Role update contained immutable fields that were silently stripped', {
            event: 'ROLE_UPDATE_STRIPPED_FIELDS',
            userId,
            orgId: req.params.orgId,
            roleId: req.params.roleId,
            strippedFields: stripped,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    }
    next();
};
orgRolesRouter.get('/organizations/:orgId/roles', auth_1.authenticate, injectOrgIdToQuery, (req, res, next) => controller.listRoles(req, res).catch(next));
orgRolesRouter.post('/organizations/:orgId/roles', auth_1.authenticate, injectOrgIdToBody, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.create), (req, res, next) => controller.createRole(req, res).catch(next));
orgRolesRouter.post('/organizations/:orgId/roles/reorder', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.orgIdParam, 'params'), (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.reorder), (req, res, next) => controller.reorderRoles(req, res).catch(next));
orgRolesRouter.put('/organizations/:orgId/roles/:roleId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.orgRoleIdParams, 'params'), auditStrippedRoleUpdateFields, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.update), (req, res, next) => controller.updateRole(req, res).catch(next));
orgRolesRouter.delete('/organizations/:orgId/roles/:roleId', auth_1.authenticate, (0, schemaValidation_1.validateSchema)(roleSchemas_1.roleSchemas.orgRoleIdParams, 'params'), (req, res, next) => controller.deleteRole(req, res).catch(next));
//# sourceMappingURL=roles.js.map