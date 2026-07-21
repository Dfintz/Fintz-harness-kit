import { Application, Router } from 'express';

import { ReputationController } from '../controllers/reputationController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { paramSchemas, reputationSchemas } from '../schemas';
const router = Router();

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the bare
// `/api` prefix, so a router-level `router.use(authenticateToken)` would also run on
// unmatched `/api/*` requests handled by other routers (leaking 401s). Spreading the
// stack onto each route keeps enforcement scoped to this router's own paths.
const authStack = [authenticateToken] as const;

// Lazy initialization to avoid EntityMetadataNotFoundError
let reputationController: ReputationController;
const getController = () => {
    if (!reputationController) {
        reputationController = new ReputationController();
    }
    return reputationController;
};

export function setReputationRoutes(app: Application) {
    router.get('/reputation/:userId', ...authStack, validateSchema(paramSchemas.id, 'params'), (req, res) => getController().getUserReputation(req, res));
    router.put('/reputation/:userId', ...authStack, validateSchema(reputationSchemas.update, 'body'), (req, res) => getController().updateReputation(req, res));
    router.get('/reputation/top', ...authStack, (req, res) => getController().getTopReputation(req, res));

    app.use('/api', router);
}
