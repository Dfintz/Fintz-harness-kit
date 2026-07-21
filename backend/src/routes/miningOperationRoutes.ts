import { Router, Application } from 'express';

import { MiningOperationController } from '../controllers/miningOperationController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { miningOperationQuerySchemas, miningSchemas } from '../schemas';
const router = Router();

// Apply authentication to all mining operation routes
router.use(authenticateToken);

// Lazy initialization to avoid EntityMetadataNotFoundError
let miningOperationController: MiningOperationController;
const getController = () => {
  if (!miningOperationController) {
    miningOperationController = new MiningOperationController();
  }
  return miningOperationController;
};

export function setMiningOperationRoutes(app: Application) {
  router.post(
    '/mining-operations',
    validateSchema(miningSchemas.createOperation, 'body'),
    (req, res) => getController().createMiningOperation(req, res)
  );
  router.get(
    '/mining-operations',
    validateSchema(miningOperationQuerySchemas.listQuery, 'query'),
    (req, res) => getController().getMiningOperations(req, res)
  );
  router.get(
    '/mining-operations/:id',
    validateSchema(miningOperationQuerySchemas.idParam, 'params'),
    (req, res) => getController().getMiningOperationById(req, res)
  );
  router.post(
    '/mining-operations/:id/crew',
    validateSchema(miningOperationQuerySchemas.idParam, 'params'),
    validateSchema(miningOperationQuerySchemas.addCrewBody, 'body'),
    (req, res) => getController().addCrewMember(req, res)
  );
  router.post(
    '/mining-operations/:id/resources',
    validateSchema(miningOperationQuerySchemas.idParam, 'params'),
    validateSchema(miningOperationQuerySchemas.updateResourcesBody, 'body'),
    (req, res) => getController().recordResources(req, res)
  );
  router.put(
    '/mining-operations/:id/status',
    validateSchema(miningOperationQuerySchemas.idParam, 'params'),
    validateSchema(miningOperationQuerySchemas.updateStatusBody, 'body'),
    (req, res) => getController().updateStatus(req, res)
  );

  app.use('/api', router);
}
