import { Router } from 'express';

import { StarCommsV2Controller } from '../../controllers/v2/starCommsV2Controller';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { starCommsSchemas } from '../../schemas/starCommsSchemas';

const router = Router();
const controller = new StarCommsV2Controller();

router.use(authenticate);

router.get('/starcomms/accessible', controller.listAccessible);

router.get(
  '/federations/:federationId/starcomms/config',
  validateSchema(starCommsSchemas.federationIdParam, 'params'),
  controller.getFederationConfig
);

router.put(
  '/federations/:federationId/starcomms/config',
  validateSchema(starCommsSchemas.federationIdParam, 'params'),
  validateSchema(starCommsSchemas.updateFederationConfigBody, 'body'),
  controller.updateFederationConfig
);

router.get(
  '/federations/:federationId/starcomms/sharing/suggestions',
  validateSchema(starCommsSchemas.federationIdParam, 'params'),
  controller.getFederationSharingSuggestions
);

export { router };
