import { Application, Router } from 'express';

import { CargoManifestController } from '../controllers/cargoManifestController';
import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../middleware/tenantContext';
import { cargoSchemas, paramSchemas } from '../schemas';
const router = Router();

// Shared middleware stack applied PER-ROUTE (not via router.use). This router is
// mounted at the bare `/api` prefix, so a router-level `router.use(...)` would run
// auth + tenant enforcement on every unmatched `/api/*` request that flows through
// this router before reaching its real handler (e.g. blocking org-less users on
// `/api/rsi/verify/*`). Spreading the stack onto each route keeps enforcement scoped
// to this router's own paths.
const authStack = [authenticateToken, tenantContextMiddleware, requireTenantContext] as const;

let cargoManifestController: CargoManifestController;
const getCargoManifestController = () => {
  if (!cargoManifestController) {
    cargoManifestController = new CargoManifestController();
  }
  return cargoManifestController;
};

export function setCargoManifestRoutes(app: Application) {
  router.post('/cargo-manifests', ...authStack, validateSchema(cargoSchemas.create, 'body'), (req, res) =>
    getCargoManifestController().createManifest(req, res)
  );
  router.get('/cargo-manifests', ...authStack, (req, res) =>
    getCargoManifestController().getManifests(req, res)
  );
  router.get('/cargo-manifests/:id', ...authStack, validateSchema(paramSchemas.id, 'params'), (req, res) =>
    getCargoManifestController().getManifestById(req, res)
  );
  router.post(
    '/cargo-manifests/:id/cargo',
    ...authStack,
    validateSchema(cargoSchemas.addItem, 'body'),
    (req, res) => getCargoManifestController().addCargoItem(req, res)
  );
  router.put(
    '/cargo-manifests/:id/status',
    ...authStack,
    validateSchema(cargoSchemas.updateStatus, 'body'),
    (req, res) => getCargoManifestController().updateStatus(req, res)
  );
  router.put(
    '/cargo-manifests/:id/sharing',
    ...authStack,
    validateSchema(cargoSchemas.updateSharing, 'body'),
    (req, res) => getCargoManifestController().updateSharing(req, res)
  );

  app.use('/api', router);
}
