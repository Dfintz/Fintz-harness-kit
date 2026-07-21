import { Application, Request, Response, Router } from 'express';

import { ImageController } from '../controllers/imageController';
import { authenticateToken } from '../middleware/auth';
import { requireAdmin } from '../middleware/authorization';
import {
  handleFileUploadError,
  imageUploadConfig,
  requireFile,
  validateFileMetadata,
} from '../middleware/fileValidation';
import { validateSchema } from '../middleware/schemaValidation';
import { uploadRateLimiter } from '../middleware/security';
import { paramSchemas } from '../schemas';
const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let imageController: ImageController;
const getController = () => {
  if (!imageController) {
    imageController = new ImageController();
  }
  return imageController;
};

export function setImageRoutes(app: Application) {
  // Download an image by filename (public — no auth required).
  // Images use unguessable UUID filenames so URLs are not enumerable.
  // Cross-Origin-Resource-Policy is set to 'cross-origin' so <img> tags on
  // the frontend origin can embed images served from the API origin.
  router.get('/images/download/:fileName', (req: Request, res: Response) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    void getController().downloadImage(req, res);
  });

  // Auth applied PER-ROUTE (not via router.use). This router is mounted path-less at
  // `/api/v2`, so a router-level `router.use(authenticateToken)` would run on every
  // unmatched `/api/v2/*` request that falls through to this router, 401-ing it instead
  // of letting it 404. The public download route above stays unguarded; every route
  // below spreads `authStack` so enforcement stays scoped to this router's own paths.
  const authStack = [authenticateToken] as const;

  // Upload an image
  router.post(
    '/images/upload',
    ...authStack,
    uploadRateLimiter,
    imageUploadConfig.single('image'),
    requireFile,
    validateFileMetadata,
    handleFileUploadError,
    (req: Request, res: Response) => getController().uploadImage(req, res)
  );

  // Get image URL by filename
  router.get('/images/url/:fileName', ...authStack, (req, res) =>
    getController().getImageUrl(req, res)
  );

  // Delete an image by filename (admin only — no per-image ownership tracking)
  router.delete(
    '/images/:fileName',
    ...authStack,
    requireAdmin,
    validateSchema(paramSchemas.id, 'params'),
    (req, res) => getController().deleteImage(req, res)
  );

  // List all images (admin only — exposes full storage inventory)
  router.get('/images', ...authStack, requireAdmin, (req, res) =>
    getController().listImages(req, res)
  );

  app.use('/api/v2', router);
}
