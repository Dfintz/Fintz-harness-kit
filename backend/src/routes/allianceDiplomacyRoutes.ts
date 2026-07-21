import { Application, Router } from 'express';

import { AllianceDiplomacyController } from '../controllers/allianceDiplomacyController';
import { botOrUserAuth } from '../middleware/botOrUserAuth';
import { validateSchema } from '../middleware/schemaValidation';
import { diplomacySchemas, paramSchemas } from '../schemas';
const router = Router();

// Routes accept either a JWT-authenticated user request or a Discord-bot
// internal call (BOT_INTERNAL_SECRET + X-Discord-Guild-Id). See botOrUserAuth.
const orgAuth = [botOrUserAuth];

// Lazy initialization to avoid EntityMetadataNotFoundError
let allianceDiplomacyController: AllianceDiplomacyController;
const getController = () => {
  if (!allianceDiplomacyController) {
    allianceDiplomacyController = new AllianceDiplomacyController();
  }
  return allianceDiplomacyController;
};

export function setAllianceDiplomacyRoutes(app: Application) {
  router.post(
    '/alliance-diplomacy',
    ...orgAuth,
    validateSchema(diplomacySchemas.proposal, 'body'),
    (req, res) => getController().proposeDiplomacy(req, res)
  );
  router.get('/alliance-diplomacy', ...orgAuth, (req, res) =>
    getController().getDiplomacyRelations(req, res)
  );
  router.get(
    '/alliance-diplomacy/:id',
    ...orgAuth,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().getDiplomacyById(req, res)
  );
  router.post(
    '/alliance-diplomacy/:id/approve',
    ...orgAuth,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().approveDiplomacy(req, res)
  );
  router.post(
    '/alliance-diplomacy/:id/suspend',
    ...orgAuth,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().suspendDiplomacy(req, res)
  );
  router.post(
    '/alliance-diplomacy/:id/terminate',
    ...orgAuth,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().terminateDiplomacy(req, res)
  );
  router.post(
    '/alliance-diplomacy/:id/incidents',
    ...orgAuth,
    validateSchema(diplomacySchemas.incident, 'body'),
    (req, res) => getController().reportIncident(req, res)
  );
  router.put(
    '/alliance-diplomacy/:id/incidents/:incidentId/resolve',
    ...orgAuth,
    validateSchema(diplomacySchemas.resolution, 'body'),
    (req, res) => getController().resolveIncident(req, res)
  );

  app.use('/api', router);
}
