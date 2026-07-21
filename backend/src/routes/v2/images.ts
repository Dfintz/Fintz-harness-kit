/**
 * Images Routes (API v2)
 *
 * Image upload and management endpoints supporting:
 * - Image upload with validation
 * - Image download and URL retrieval
 * - Image deletion
 * - Image listing and filtering
 *
 * Upload, delete, list, and URL routes require authentication.
 * Download is public (images use unguessable UUID filenames) so that
 * cross-origin <img> tags work without auth cookies.
 */

import { Request, Response, Router } from 'express';

import { ImageController } from '../../controllers/imageController';
import { authenticate } from '../../middleware/auth';
import {
  handleFileUploadError,
  imageUploadConfig,
  requireFile,
  validateFileMetadata,
} from '../../middleware/fileValidation';
import { validateSchema } from '../../middleware/schemaValidation';
import { uploadRateLimiter } from '../../middleware/security';
import { paramSchemas } from '../../schemas';

const router = Router();

// Lazy initialization to avoid EntityMetadataNotFoundError
let imageController: ImageController;
const getController = (): ImageController => {
  if (!imageController) {
    imageController = new ImageController();
  }
  return imageController;
};

// ==================== PUBLIC IMAGE RETRIEVAL ====================

/**
 * GET /api/v2/images/download/:fileName
 * Download an image by filename (public — no auth required).
 * Images use UUID filenames so URLs are unguessable.
 *
 * Cross-Origin-Resource-Policy set to 'cross-origin' so that <img> tags on
 * fringecore.space can embed images served from api.fringecore.space.
 */
router.get('/download/:fileName', (req: Request, res: Response) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  void getController().downloadImage(req, res);
});

// ==================== AUTHENTICATED ROUTES ====================

// All routes below require authentication
router.use(authenticate);

// ==================== IMAGE UPLOAD ====================

/**
 * POST /api/v2/images/upload
 * Upload an image file
 * Form data: image file (multipart/form-data)
 * Returns: upload result with image metadata
 */
router.post(
  '/upload',
  uploadRateLimiter,
  imageUploadConfig.single('image'),
  requireFile,
  validateFileMetadata,
  handleFileUploadError,
  (req: Request, res: Response) => getController().uploadImage(req, res)
);

/**
 * GET /api/v2/images/url/:fileName
 * Get download URL for an image
 * Returns: signed download URL
 * Requires: valid image filename
 */
router.get('/url/:fileName', (req: Request, res: Response) =>
  getController().getImageUrl(req, res)
);

/**
 * GET /api/v2/images
 * List all images
 * Query parameters: prefix filter, pagination
 * Returns: list of available images
 */
router.get('/', (req: Request, res: Response) => getController().listImages(req, res));

// ==================== IMAGE DELETION ====================

/**
 * DELETE /api/v2/images/:fileName
 * Delete an image by filename
 * Requires: valid image filename
 */
router.delete(
  '/:fileName',
  validateSchema(paramSchemas.id, 'params'),
  (req: Request, res: Response) => getController().deleteImage(req, res)
);

export { router };

