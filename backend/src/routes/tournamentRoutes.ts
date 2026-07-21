import { Application, Router } from 'express';

import { TournamentController } from '../controllers/tournamentController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { tournamentQuerySchemas, tournamentSchemas } from '../schemas';
const router = Router();

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the bare
// `/api` prefix, so a router-level `router.use(authenticateToken)` would also run on
// unmatched `/api/*` requests handled by other routers (leaking 401s). Spreading the
// stack onto each route keeps enforcement scoped to this router's own paths.
const authStack = [authenticateToken] as const;

// Lazy initialization to avoid EntityMetadataNotFoundError
let tournamentController: TournamentController;
const getController = () => {
  if (!tournamentController) {
    tournamentController = new TournamentController();
  }
  return tournamentController;
};

export function setTournamentRoutes(app: Application) {
  router.post('/tournaments', ...authStack, validateSchema(tournamentSchemas.create, 'body'), (req, res) =>
    getController().createTournament(req, res)
  );
  router.get(
    '/tournaments',
    ...authStack,
    validateSchema(tournamentQuerySchemas.listQuery, 'query'),
    (req, res) => getController().getTournaments(req, res)
  );
  router.get(
    '/tournaments/:id',
    ...authStack,
    validateSchema(tournamentQuerySchemas.idParam, 'params'),
    (req, res) => getController().getTournamentById(req, res)
  );
  router.post(
    '/tournaments/:id/register',
    ...authStack,
    validateSchema(tournamentQuerySchemas.registerBody, 'body'),
    (req, res) => getController().registerParticipant(req, res)
  );
  router.post(
    '/tournaments/:id/start',
    ...authStack,
    validateSchema(tournamentQuerySchemas.idParam, 'params'),
    (req, res) => getController().startTournament(req, res)
  );
  router.put(
    '/tournaments/:id/matches/:matchId',
    ...authStack,
    validateSchema(tournamentSchemas.updateMatch, 'body'),
    (req, res) => getController().updateMatch(req, res)
  );

  app.use('/api', router);
}
