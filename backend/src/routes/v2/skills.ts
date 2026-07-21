import { Router } from 'express';

import { SkillController } from '../../controllers/v2/skillController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { skillSchemas } from '../../schemas/skillSchemas';

const router = Router();

let skillController: SkillController;
const getController = () => {
  if (!skillController) {
    skillController = new SkillController();
  }
  return skillController;
};

// ==================== SKILLS & COMPETENCIES ====================

const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

/**
 * GET /api/v2/skills/categories
 * Get skill categories (must be before :skillId)
 */
router.get('/categories', ...orgAuth, (req, res) => getController().getCategories(req, res));

/**
 * GET /api/v2/skills/user/:userId
 * Get user skills (must be before :skillId)
 */
router.get('/user/:userId', ...orgAuth, (req, res) => getController().getUserSkills(req, res));

/**
 * GET /api/v2/skills
 * List all skills for the organization
 */
router.get('/', ...orgAuth, validateSchema(skillSchemas.query, 'query'), (req, res) =>
  getController().listSkills(req, res)
);

/**
 * POST /api/v2/skills
 * Create a new skill
 */
router.post('/', ...orgAuth, validateSchema(skillSchemas.create, 'body'), (req, res) =>
  getController().createSkill(req, res)
);

/**
 * GET /api/v2/skills/:skillId
 * Get a specific skill
 */
router.get('/:skillId', ...orgAuth, validateSchema(skillSchemas.param, 'params'), (req, res) =>
  getController().getSkill(req, res)
);

/**
 * PUT /api/v2/skills/:skillId
 * Update a skill
 */
router.put(
  '/:skillId',
  ...orgAuth,
  validateSchema(skillSchemas.param, 'params'),
  validateSchema(skillSchemas.update, 'body'),
  (req, res) => getController().updateSkill(req, res)
);

/**
 * DELETE /api/v2/skills/:skillId
 * Delete a skill
 */
router.delete('/:skillId', ...orgAuth, validateSchema(skillSchemas.param, 'params'), (req, res) =>
  getController().deleteSkill(req, res)
);

/**
 * POST /api/v2/skills/:skillId/endorse
 * Endorse a user's skill
 */
router.post(
  '/:skillId/endorse',
  ...orgAuth,
  validateSchema(skillSchemas.param, 'params'),
  validateSchema(skillSchemas.endorse, 'body'),
  (req, res) => getController().endorseSkill(req, res)
);

export { router };
