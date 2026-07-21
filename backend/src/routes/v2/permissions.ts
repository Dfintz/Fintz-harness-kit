/**
 * Permissions Routes V2
 * Routes for permission and role management
 */

import { Router } from 'express';

import { PermissionsControllerV2 } from '../../controllers/v2/permissionsController';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new PermissionsControllerV2();

/**
 * @route GET /api/v2/permissions
 * @desc List all available permissions (admin only)
 * @access Admin
 */
router.get('/', authenticate, controller.listPermissions.bind(controller));

/**
 * @route GET /api/v2/permissions/:id
 * @desc Get permission details
 * @access Admin
 */
router.get('/:id', authenticate, controller.getPermission.bind(controller));

/**
 * @route POST /api/v2/permissions/check
 * @desc Check if user has a specific permission
 * @access Authenticated (admin or own permissions)
 */
router.post('/check', authenticate, controller.checkPermission.bind(controller));

/**
 * @route GET /api/v2/organizations/:organizationId/users/:userId/permissions
 * @desc Get all permissions for a user in an organization
 * @access Organization admin or self
 */
router.get(
  '/organizations/:organizationId/users/:userId/permissions',
  authenticate,
  controller.getUserPermissionsForOrg.bind(controller)
);

/**
 * @route POST /api/v2/organizations/:organizationId/users/:userId/permissions
 * @desc Grant permission to a user
 * @access Organization admin
 */
router.post(
  '/organizations/:organizationId/users/:userId/permissions',
  authenticate,
  controller.grantPermission.bind(controller)
);

/**
 * @route DELETE /api/v2/organizations/:organizationId/users/:userId/permissions
 * @desc Revoke permission from a user
 * @access Organization admin
 */
router.delete(
  '/organizations/:organizationId/users/:userId/permissions',
  authenticate,
  controller.revokePermission.bind(controller)
);

/**
 * @route PUT /api/v2/organizations/:organizationId/users/:userId/security-level
 * @desc Update user security level in organization
 * @access Organization admin
 */
router.put(
  '/organizations/:organizationId/users/:userId/security-level',
  authenticate,
  controller.updateSecurityLevel.bind(controller)
);

/**
 * @route POST /api/v2/security-levels
 * @desc Set inter-organization security level
 * @access Admin
 */
router.post('/security-levels', authenticate, controller.setInterOrgSecurityLevel.bind(controller));

/**
 * @route GET /api/v2/organizations/:organizationId/security-levels
 * @desc Get inter-org security levels for an organization
 * @access Organization admin or self
 */
router.get(
  '/organizations/:organizationId/security-levels',
  authenticate,
  controller.getOrgSecurityLevels.bind(controller)
);

/**
 * @route GET /api/v2/security-levels
 * @desc Get all inter-org security levels (admin only)
 * @access Admin
 */
router.get('/security-levels', authenticate, controller.getAllSecurityLevels.bind(controller));

/**
 * @route DELETE /api/v2/security-levels
 * @desc Revoke/deactivate an inter-org security level
 * @access Admin
 */
router.delete(
  '/security-levels',
  authenticate,
  controller.revokeInterOrgSecurityLevel.bind(controller)
);

/**
 * Organization-scoped permission routes (mounted at root level in v2 index).
 * Frontend expects: /api/v2/organizations/:orgId/users/:userId/permissions
 * These can't be under the /permissions prefix or the path would be
 * /api/v2/permissions/organizations/... which doesn't match.
 */
const orgPermissionRoutes = Router();

orgPermissionRoutes.get(
  '/organizations/:organizationId/users/:userId/permissions',
  authenticate,
  controller.getUserPermissionsForOrg.bind(controller)
);

orgPermissionRoutes.post(
  '/organizations/:organizationId/users/:userId/permissions',
  authenticate,
  controller.grantPermission.bind(controller)
);

orgPermissionRoutes.delete(
  '/organizations/:organizationId/users/:userId/permissions',
  authenticate,
  controller.revokePermission.bind(controller)
);

orgPermissionRoutes.put(
  '/organizations/:organizationId/users/:userId/security-level',
  authenticate,
  controller.updateSecurityLevel.bind(controller)
);

orgPermissionRoutes.get(
  '/organizations/:organizationId/security-levels',
  authenticate,
  controller.getOrgSecurityLevels.bind(controller)
);

export { orgPermissionRoutes, router };
