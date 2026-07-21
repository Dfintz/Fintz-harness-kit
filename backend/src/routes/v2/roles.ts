/**
 * Roles Routes V2
 * Comprehensive role management and RBAC endpoints
 */

import { NextFunction, Request, Response, Router } from 'express';

import { RolesControllerV2 } from '../../controllers/v2/rolesController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { roleSchemas } from '../../schemas/roleSchemas';
import { logger } from '../../utils/logger';

const router = Router();
const controller = new RolesControllerV2();

/**
 * Role Management Endpoints
 */

/**
 * @route GET /api/v2/roles
 * @desc List all available roles with pagination
 * @access Authenticated
 */
router.get('/', authenticate, validateSchema(roleSchemas.listQuery, 'query'), (req, res) =>
  controller.listRoles(req, res)
);

/**
 * @route POST /api/v2/roles
 * @desc Create custom role (admin only)
 * @access Authenticated (admin)
 * @body {name, description, scope, permissions}
 */
router.post('/', authenticate, validateSchema(roleSchemas.create), (req, res) =>
  controller.createRole(req, res)
);

/**
 * Static paths MUST be defined before the /:roleId parameter route
 * to prevent Express from treating "templates", "search" etc. as a roleId.
 */

/**
 * Role Search & Template Endpoints (static — before /:roleId)
 */

/**
 * @route GET /api/v2/roles/search/by-scope
 * @desc Search roles by scope (system, organization, fleet)
 * @access Authenticated
 * @query {scope}
 */
router.get(
  '/search/by-scope',
  authenticate,
  validateSchema(roleSchemas.searchByScopeQuery, 'query'),
  (req, res) => controller.searchByScope(req, res)
);

/**
 * @route GET /api/v2/roles/templates
 * @desc Get predefined role templates
 * @access Authenticated
 */
router.get('/templates', authenticate, (req, res) => controller.getTemplates(req, res));

/**
 * @route POST /api/v2/roles/templates/:templateId/apply
 * @desc Apply a template to create or update a role (admin only)
 * @access Authenticated (admin)
 * @body {roleName, organizationId}
 */
router.post(
  '/templates/:templateId/apply',
  authenticate,
  validateSchema(roleSchemas.templateIdParam, 'params'),
  validateSchema(roleSchemas.applyTemplate),
  (req, res) => controller.applyTemplate(req, res)
);

/**
 * Parameterized /:roleId routes (AFTER all static paths)
 */

/**
 * @route GET /api/v2/roles/:roleId
 * @desc Get detailed role information
 * @access Authenticated
 */
router.get(
  '/:roleId',
  authenticate,
  validateSchema(roleSchemas.roleIdParam, 'params'),
  (req, res) => controller.getRole(req, res)
);

/**
 * @route PUT /api/v2/roles/:roleId
 * @desc Update custom role (admin only)
 * @access Authenticated (admin)
 */
router.put(
  '/:roleId',
  authenticate,
  validateSchema(roleSchemas.roleIdParam, 'params'),
  validateSchema(roleSchemas.update),
  (req, res) => controller.updateRole(req, res)
);

/**
 * @route DELETE /api/v2/roles/:roleId
 * @desc Delete custom role (admin only)
 * @access Authenticated (admin)
 */
router.delete(
  '/:roleId',
  authenticate,
  validateSchema(roleSchemas.roleIdParam, 'params'),
  (req, res) => controller.deleteRole(req, res)
);

/**
 * Role Assignment Endpoints
 */

/**
 * @route POST /api/v2/roles/:roleId/assign
 * @desc Assign role to user in organization
 * @access Authenticated (admin)
 * @body {userId, organizationId}
 */
router.post(
  '/:roleId/assign',
  authenticate,
  validateSchema(roleSchemas.roleIdParam, 'params'),
  validateSchema(roleSchemas.assign),
  (req, res) => controller.assignRoleToUser(req, res)
);

/**
 * @route DELETE /api/v2/roles/:roleId/assign/:userId
 * @desc Remove role from user
 * @access Authenticated (admin)
 */
router.delete(
  '/:roleId/assign/:userId',
  authenticate,
  validateSchema(roleSchemas.roleIdUserIdParams, 'params'),
  (req, res) => controller.removeRoleFromUser(req, res)
);

/**
 * Permission Management Endpoints
 */

/**
 * @route GET /api/v2/roles/:roleId/permissions
 * @desc Get all permissions for a role
 * @access Authenticated
 */
router.get(
  '/:roleId/permissions',
  authenticate,
  validateSchema(roleSchemas.roleIdParam, 'params'),
  (req, res) => controller.getRolePermissions(req, res)
);

/**
 * @route POST /api/v2/roles/:roleId/permissions
 * @desc Add permission to role (admin only)
 * @access Authenticated (admin)
 * @body {permissionId}
 */
router.post(
  '/:roleId/permissions',
  authenticate,
  validateSchema(roleSchemas.roleIdParam, 'params'),
  validateSchema(roleSchemas.addPermission),
  (req, res) => controller.addPermissionToRole(req, res)
);

/**
 * @route DELETE /api/v2/roles/:roleId/permissions/:permissionId
 * @desc Remove permission from role (admin only)
 * @access Authenticated (admin)
 */
router.delete(
  '/:roleId/permissions/:permissionId',
  authenticate,
  validateSchema(roleSchemas.roleIdPermissionIdParams, 'params'),
  (req, res) => controller.removePermissionFromRole(req, res)
);

/**
 * Organization-scoped role routes (mounted at root level in v2 index)
 * Frontend expects: /api/v2/organizations/:orgId/roles
 */
const orgRolesRouter = Router();

/** Inject orgId from URL param into query.organizationId for listRoles */
const injectOrgIdToQuery = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.params.orgId) {
    req.query.organizationId = req.params.orgId;
  }
  next();
};

/**
 * Inject orgId from URL param into body.organizationId for createRole
 * and force scope='organization' so the org-scoped route cannot be used
 * to create a system-scoped role (defense-in-depth alongside
 * verifyRoleManagementAccess authorization check).
 */
const injectOrgIdToBody = (req: Request, _res: Response, next: NextFunction): void => {
  if (req.params.orgId) {
    const body = req.body as Record<string, unknown>;
    body.organizationId ??= req.params.orgId;
    body.scope = 'organization';
  }
  next();
};

/**
 * Audit-log immutable fields silently stripped by validateSchema(roleSchemas.update).
 * `isSystemRole` and `organizationId` are intentionally omitted from the update
 * schema (stripUnknown: true drops them), so a client that submits them gets a
 * 200 OK but those fields are ignored. Surface the attempt so security audits can
 * catch misconfigured clients or probing behavior. Does NOT block the request.
 */
const auditStrippedRoleUpdateFields = (req: Request, _res: Response, next: NextFunction): void => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const stripped: string[] = [];
  if ('isSystemRole' in body) {
    stripped.push('isSystemRole');
  }
  if ('organizationId' in body) {
    stripped.push('organizationId');
  }
  if (stripped.length > 0) {
    const userId = (req as Request & { user?: { id?: string } }).user?.id ?? 'anonymous';
    logger.warn('Role update contained immutable fields that were silently stripped', {
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

orgRolesRouter.get(
  '/organizations/:orgId/roles',
  authenticate,
  injectOrgIdToQuery,
  (req, res, next) => controller.listRoles(req, res).catch(next)
);

orgRolesRouter.post(
  '/organizations/:orgId/roles',
  authenticate,
  injectOrgIdToBody,
  validateSchema(roleSchemas.create),
  (req, res, next) => controller.createRole(req, res).catch(next)
);

orgRolesRouter.post(
  '/organizations/:orgId/roles/reorder',
  authenticate,
  validateSchema(roleSchemas.orgIdParam, 'params'),
  validateSchema(roleSchemas.reorder),
  (req, res, next) => controller.reorderRoles(req, res).catch(next)
);

orgRolesRouter.put(
  '/organizations/:orgId/roles/:roleId',
  authenticate,
  validateSchema(roleSchemas.orgRoleIdParams, 'params'),
  auditStrippedRoleUpdateFields,
  validateSchema(roleSchemas.update),
  (req, res, next) => controller.updateRole(req, res).catch(next)
);

orgRolesRouter.delete(
  '/organizations/:orgId/roles/:roleId',
  authenticate,
  validateSchema(roleSchemas.orgRoleIdParams, 'params'),
  (req, res, next) => controller.deleteRole(req, res).catch(next)
);

export { orgRolesRouter, router };
