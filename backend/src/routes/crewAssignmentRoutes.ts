import { Application, Router } from 'express';

import { CrewAssignmentController } from '../controllers/crewAssignmentController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { crewSchemas, paramSchemas } from '../schemas';
const router = Router();

// Auth applied PER-ROUTE (not via router.use). This router is mounted at the bare
// `/api` prefix, so a router-level `router.use(authenticateToken)` would also run on
// unmatched `/api/*` requests handled by other routers (leaking 401s). Spreading the
// stack onto each route keeps enforcement scoped to this router's own paths.
const authStack = [authenticateToken] as const;

// Lazy initialization to avoid EntityMetadataNotFoundError
let crewAssignmentController: CrewAssignmentController;
const getController = () => {
    if (!crewAssignmentController) {
        crewAssignmentController = new CrewAssignmentController();
    }
    return crewAssignmentController;
};

export function setCrewAssignmentRoutes(app: Application) {
    router.post('/crew-assignments', ...authStack, validateSchema(crewSchemas.create, 'body'), (req, res) => getController().createAssignment(req, res));
    router.get('/crew-assignments', ...authStack, (req, res) => getController().getAssignments(req, res));
    router.get('/crew-assignments/:id', ...authStack, validateSchema(paramSchemas.id, 'params'), (req, res) => getController().getAssignmentById(req, res));
    router.post('/crew-assignments/:id/crew', ...authStack, validateSchema(crewSchemas.addMember, 'body'), (req, res) => getController().addCrewMember(req, res));
    router.delete('/crew-assignments/:id/crew/:userId', ...authStack, validateSchema(crewSchemas.removeMember, 'body'), (req, res) => getController().removeCrewMember(req, res));
    router.put('/crew-assignments/:id/status', ...authStack, validateSchema(paramSchemas.id, 'params'), (req, res) => getController().updateStatus(req, res));

    app.use('/api', router);
}
