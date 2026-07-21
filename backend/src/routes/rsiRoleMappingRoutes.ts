/**
 * RSI Role Mapping Routes
 *
 * Routes for managing RSI rank to Discord role and RBAC permission mappings.
 * Phase 2: RSI Role Sync System - Role Mapping Configuration
 */

import { Router } from 'express';

import { RsiRoleMappingController } from '../controllers/rsiRoleMappingController';
import { authenticateToken } from '../middleware/auth';
import { botOrUserAuth } from '../middleware/botOrUserAuth';
import { validateSchema } from '../middleware/schemaValidation';
import { rsiRoleMappingSchemas } from '../schemas/rsiRoleMappingSchemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let roleMappingController: RsiRoleMappingController;
const getController = (): RsiRoleMappingController => {
  if (!roleMappingController) {
    roleMappingController = new RsiRoleMappingController();
  }
  return roleMappingController;
};

export const setRsiRoleMappingRoutes = (app: Router): void => {
  // ==================== TEMPLATE ROUTES ====================
  // These don't require organization context

  /**
   * Get available templates
   * GET /api/rsi-role-mappings/templates
   */
  router.get('/rsi-role-mappings/templates', authenticateToken, (req, res) =>
    getController().getTemplates(req, res)
  );

  /**
   * Get template details
   * GET /api/rsi-role-mappings/templates/:templateName
   */
  router.get('/rsi-role-mappings/templates/:templateName', authenticateToken, (req, res) =>
    getController().getTemplateDetails(req, res)
  );

  // ==================== ORGANIZATION-SCOPED ROUTES ====================

  /**
   * Get all role mappings for an organization
   * GET /api/organizations/:organizationId/rsi-role-mappings
   */
  router.get(
    '/organizations/:organizationId/rsi-role-mappings',
    botOrUserAuth,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    validateSchema(rsiRoleMappingSchemas.listMappingsQuery, 'query'),
    (req, res) => getController().getMappings(req, res)
  );

  /**
   * Get organization mapping summary
   * GET /api/organizations/:organizationId/rsi-role-mappings/summary
   */
  router.get(
    '/organizations/:organizationId/rsi-role-mappings/summary',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    (req, res) => getController().getSummary(req, res)
  );

  /**
   * Get a specific role mapping
   * GET /api/organizations/:organizationId/rsi-role-mappings/:id
   */
  router.get(
    '/organizations/:organizationId/rsi-role-mappings/:id',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    (req, res) => getController().getMapping(req, res)
  );

  /**
   * Create a new role mapping
   * POST /api/organizations/:organizationId/rsi-role-mappings
   */
  router.post(
    '/organizations/:organizationId/rsi-role-mappings',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    validateSchema(rsiRoleMappingSchemas.createMapping, 'body'),
    (req, res) => getController().createMapping(req, res)
  );

  /**
   * Apply a template to an organization
   * POST /api/organizations/:organizationId/rsi-role-mappings/apply-template
   */
  router.post(
    '/organizations/:organizationId/rsi-role-mappings/apply-template',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    validateSchema(rsiRoleMappingSchemas.applyTemplate, 'body'),
    (req, res) => getController().applyTemplate(req, res)
  );

  /**
   * Bulk upsert mappings
   * POST /api/organizations/:organizationId/rsi-role-mappings/bulk
   */
  router.post(
    '/organizations/:organizationId/rsi-role-mappings/bulk',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    validateSchema(rsiRoleMappingSchemas.bulkUpsert, 'body'),
    (req, res) => getController().bulkUpsert(req, res)
  );

  /**
   * Clone mappings from another organization
   * POST /api/organizations/:organizationId/rsi-role-mappings/clone
   */
  router.post(
    '/organizations/:organizationId/rsi-role-mappings/clone',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    validateSchema(rsiRoleMappingSchemas.cloneMappings, 'body'),
    (req, res) => getController().cloneMappings(req, res)
  );

  /**
   * Update a role mapping
   * PUT /api/organizations/:organizationId/rsi-role-mappings/:id
   */
  router.put(
    '/organizations/:organizationId/rsi-role-mappings/:id',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    validateSchema(rsiRoleMappingSchemas.updateMapping, 'body'),
    (req, res) => getController().updateMapping(req, res)
  );

  /**
   * Delete a role mapping
   * DELETE /api/organizations/:organizationId/rsi-role-mappings/:id
   */
  router.delete(
    '/organizations/:organizationId/rsi-role-mappings/:id',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    (req, res) => getController().deleteMapping(req, res)
  );

  /**
   * Delete all mappings for an organization
   * DELETE /api/organizations/:organizationId/rsi-role-mappings
   */
  router.delete(
    '/organizations/:organizationId/rsi-role-mappings',
    authenticateToken,
    validateSchema(rsiRoleMappingSchemas.organizationIdParam, 'params'),
    (req, res) => getController().deleteAllMappings(req, res)
  );

  app.use('/api', router);
};
