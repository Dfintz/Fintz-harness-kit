import { Request, Response, Router } from 'express';

import { ActivityTemplateControllerV2 } from '../../controllers/v2/activityTemplateController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { tenantContextMiddleware } from '../../middleware/tenantContext';
import { activityTemplateSchemas } from '../../schemas';

const router = Router();

// All template routes require authentication and organization context
router.use(authenticate);
router.use(tenantContextMiddleware);

// Lazy-init controller
let controller: ActivityTemplateControllerV2;
const getController = () => {
  if (!controller) {
    controller = new ActivityTemplateControllerV2();
  }
  return controller;
};

// ==================== TEMPLATES ====================

// Static routes MUST be before :templateId to avoid "categories" matching as a param
router.get('/categories', (req: Request, res: Response) => getController().getCategories(req, res));

router.get(
  '/',
  validateSchema(activityTemplateSchemas.query, 'query'),
  (req: Request, res: Response) => getController().listTemplates(req, res)
);

router.post(
  '/',
  validateSchema(activityTemplateSchemas.create, 'body'),
  (req: Request, res: Response) => getController().createTemplate(req, res)
);

router.get(
  '/:templateId',
  validateSchema(activityTemplateSchemas.param, 'params'),
  (req: Request, res: Response) => getController().getTemplate(req, res)
);

router.put(
  '/:templateId',
  validateSchema(activityTemplateSchemas.param, 'params'),
  validateSchema(activityTemplateSchemas.update, 'body'),
  (req: Request, res: Response) => getController().updateTemplate(req, res)
);

router.delete(
  '/:templateId',
  validateSchema(activityTemplateSchemas.param, 'params'),
  (req: Request, res: Response) => getController().deleteTemplate(req, res)
);

router.post(
  '/:templateId/clone',
  validateSchema(activityTemplateSchemas.param, 'params'),
  (req: Request, res: Response) => getController().cloneTemplate(req, res)
);

router.post(
  '/:templateId/apply',
  validateSchema(activityTemplateSchemas.param, 'params'),
  validateSchema(activityTemplateSchemas.apply, 'body'),
  (req: Request, res: Response) => getController().applyTemplate(req, res)
);

export { router };
