import { Application, Router } from 'express';

import { BriefingController } from '../controllers/briefingController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { tenantContextMiddleware } from '../middleware/tenantContext';
import { briefingSchemas, paramSchemas } from '../schemas';

const router = Router();

// Shared middleware stack applied PER-ROUTE (not via router.use). This router is mounted
// path-less at `/api/v2`, so a router-level `router.use(...)` would run auth + tenant
// enforcement on every unmatched `/api/v2/*` request that falls through to this router
// (e.g. after v2Router does not match), blocking it with 401/400 instead of letting it
// 404. Spreading the stack onto each route keeps enforcement scoped to this router's
// own `/briefings*` paths.
const authStack = [authenticateToken, tenantContextMiddleware] as const;

// Lazy initialization to avoid EntityMetadataNotFoundError
let briefingController: BriefingController;
const getController = () => {
  if (!briefingController) {
    briefingController = new BriefingController();
  }
  return briefingController;
};

export const setBriefingRoutes = (app: Application) => {
  router.post(
    '/briefings',
    ...authStack,
    validateSchema(briefingSchemas.create, 'body'),
    (req, res) => getController().createBriefing(req, res)
  );
  router.get(
    '/briefings',
    ...authStack,
    validateSchema(briefingSchemas.query, 'query'),
    (req, res) => getController().getAllBriefings(req, res)
  );
  router.get(
    '/briefings/:id',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().getBriefing(req, res)
  );
  router.get('/briefings/mission/:missionId', ...authStack, (req, res) =>
    getController().getBriefingsByMission(req, res)
  );
  router.put(
    '/briefings/:id',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    validateSchema(briefingSchemas.update, 'body'),
    (req, res) => getController().updateBriefing(req, res)
  );
  router.delete(
    '/briefings/:id',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().deleteBriefing(req, res)
  );

  router.post(
    '/briefings/:id/elements',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    validateSchema(briefingSchemas.addElement, 'body'),
    (req, res) => getController().addElement(req, res)
  );
  router.put(
    '/briefings/:id/elements/:elementId',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    validateSchema(briefingSchemas.updateElement, 'body'),
    (req, res) => getController().updateElement(req, res)
  );
  router.delete(
    '/briefings/:id/elements/:elementId',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().deleteElement(req, res)
  );

  router.post(
    '/briefings/:id/participants',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    validateSchema(briefingSchemas.addParticipant, 'body'),
    (req, res) => getController().addParticipant(req, res)
  );
  router.delete(
    '/briefings/:id/participants',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().removeParticipant(req, res)
  );

  router.put(
    '/briefings/:id/status',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    validateSchema(briefingSchemas.updateStatus, 'body'),
    (req, res) => getController().updateStatus(req, res)
  );
  router.post(
    '/briefings/:id/version',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().createVersion(req, res)
  );

  router.post(
    '/briefings/:id/post-to-discord',
    ...authStack,
    validateSchema(paramSchemas.id, 'params'),
    validateSchema(briefingSchemas.postToDiscord, 'body'),
    (req, res) => getController().postToDiscord(req, res)
  );

  app.use('/api/v2', router);
};
