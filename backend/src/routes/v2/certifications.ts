import { Router } from 'express';

import { CertificationController } from '../../controllers/v2/certificationController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { certificationSchemas } from '../../schemas/certificationSchemas';

const router = Router();

let certificationController: CertificationController;
const getController = () => {
  if (!certificationController) {
    certificationController = new CertificationController();
  }
  return certificationController;
};

// ==================== CERTIFICATIONS & TRAINING ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/certifications/user/:userId
 * Get user certifications (must be before :certificationId)
 */
router.get('/user/:userId', ...orgAuth, (req, res) =>
  getController().getUserCertifications(req, res)
);

/**
 * GET /api/v2/certifications
 * List all certifications for the organization
 */
router.get('/', ...orgAuth, validateSchema(certificationSchemas.query, 'query'), (req, res) =>
  getController().listCertifications(req, res)
);

/**
 * POST /api/v2/certifications
 * Create a new certification
 */
router.post('/', ...orgAuth, validateSchema(certificationSchemas.create, 'body'), (req, res) =>
  getController().createCertification(req, res)
);

/**
 * GET /api/v2/certifications/:certificationId
 * Get a specific certification
 */
router.get(
  '/:certificationId',
  ...orgAuth,
  validateSchema(certificationSchemas.param, 'params'),
  (req, res) => getController().getCertification(req, res)
);

/**
 * PUT /api/v2/certifications/:certificationId
 * Update a certification
 */
router.put(
  '/:certificationId',
  ...orgAuth,
  validateSchema(certificationSchemas.param, 'params'),
  validateSchema(certificationSchemas.update, 'body'),
  (req, res) => getController().updateCertification(req, res)
);

/**
 * DELETE /api/v2/certifications/:certificationId
 * Delete a certification
 */
router.delete(
  '/:certificationId',
  ...orgAuth,
  validateSchema(certificationSchemas.param, 'params'),
  (req, res) => getController().deleteCertification(req, res)
);

/**
 * POST /api/v2/certifications/:certificationId/award
 * Award certification to a user
 */
router.post(
  '/:certificationId/award',
  ...orgAuth,
  validateSchema(certificationSchemas.param, 'params'),
  validateSchema(certificationSchemas.award, 'body'),
  (req, res) => getController().awardCertification(req, res)
);

/**
 * POST /api/v2/certifications/:certificationId/revoke
 * Revoke certification from a user
 */
router.post(
  '/:certificationId/revoke',
  ...orgAuth,
  validateSchema(certificationSchemas.param, 'params'),
  validateSchema(certificationSchemas.revoke, 'body'),
  (req, res) => getController().revokeCertification(req, res)
);

/**
 * GET /api/v2/certifications/:certificationId/holders
 * Get users who hold this certification
 */
router.get(
  '/:certificationId/holders',
  ...orgAuth,
  validateSchema(certificationSchemas.param, 'params'),
  (req, res) => getController().getCertificationHolders(req, res)
);

export { router };
