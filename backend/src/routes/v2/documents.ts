import { Router } from 'express';
import multer from 'multer';

import { DocumentController } from '../../controllers/documentController';
import { authenticate } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { requireTenantContext, tenantContextMiddleware } from '../../middleware/tenantContext';
import { documentSchemas } from '../../schemas/documentSchemas';

const router = Router();

// Lazy initialization to avoid circular dependency issues
let documentController: DocumentController;
const getController = (): DocumentController => {
  if (!documentController) {
    documentController = new DocumentController();
  }
  return documentController;
};

// Memory storage for Azure Blob upload (50MB limit)
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const DANGEROUS_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.dylib']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop() ?? '';
    if (DANGEROUS_EXTENSIONS.has(`.${ext}`)) {
      return cb(new Error('Executable files are not allowed.'));
    }
    cb(null, true);
  },
});

// ==================== DOCUMENTS & FILES ====================

// All document routes require authentication + org context
const orgAuth = [authenticate, tenantContextMiddleware, requireTenantContext];

// ---- Folder routes (MUST be before /:documentId to avoid param conflicts) ----

/**
 * GET /api/v2/documents/folders
 * Get folder tree
 */
router.get('/folders', ...orgAuth, (req, res) => getController().getFolderTree(req, res));

/**
 * POST /api/v2/documents/folders
 * Create folder
 */
router.post(
  '/folders',
  ...orgAuth,
  validateSchema(documentSchemas.createFolder, 'body'),
  (req, res) => getController().createFolder(req, res)
);

/**
 * PUT /api/v2/documents/folders/:folderId
 * Update folder
 */
router.put(
  '/folders/:folderId',
  ...orgAuth,
  validateSchema(documentSchemas.folderParam, 'params'),
  validateSchema(documentSchemas.updateFolder, 'body'),
  (req, res) => getController().updateFolder(req, res)
);

/**
 * DELETE /api/v2/documents/folders/:folderId
 * Delete folder
 */
router.delete(
  '/folders/:folderId',
  ...orgAuth,
  validateSchema(documentSchemas.folderParam, 'params'),
  (req, res) => getController().deleteFolder(req, res)
);

// ---- Document routes ----

/**
 * GET /api/v2/documents
 * List documents with filters and pagination
 */
router.get('/', ...orgAuth, validateSchema(documentSchemas.query, 'query'), (req, res) =>
  getController().listDocuments(req, res)
);

/**
 * POST /api/v2/documents
 * Upload document (multipart/form-data)
 */
router.post(
  '/',
  ...orgAuth,
  upload.single('file'),
  validateSchema(documentSchemas.upload, 'body'),
  (req, res) => getController().uploadDocument(req, res)
);

/**
 * GET /api/v2/documents/:documentId
 * Get specific document
 */
router.get(
  '/:documentId',
  ...orgAuth,
  validateSchema(documentSchemas.documentParam, 'params'),
  (req, res) => getController().getDocument(req, res)
);

/**
 * PUT /api/v2/documents/:documentId
 * Update document metadata
 */
router.put(
  '/:documentId',
  ...orgAuth,
  validateSchema(documentSchemas.documentParam, 'params'),
  validateSchema(documentSchemas.update, 'body'),
  (req, res) => getController().updateDocument(req, res)
);

/**
 * DELETE /api/v2/documents/:documentId
 * Delete document (soft delete)
 */
router.delete(
  '/:documentId',
  ...orgAuth,
  validateSchema(documentSchemas.documentParam, 'params'),
  (req, res) => getController().deleteDocument(req, res)
);

/**
 * GET /api/v2/documents/:documentId/download
 * Get download URL for document
 */
router.get(
  '/:documentId/download',
  ...orgAuth,
  validateSchema(documentSchemas.documentParam, 'params'),
  (req, res) => getController().downloadDocument(req, res)
);

/**
 * POST /api/v2/documents/:documentId/share
 * Share document with user/role
 */
router.post(
  '/:documentId/share',
  ...orgAuth,
  validateSchema(documentSchemas.documentParam, 'params'),
  validateSchema(documentSchemas.share, 'body'),
  (req, res) => getController().shareDocument(req, res)
);

/**
 * GET /api/v2/documents/:documentId/versions
 * Get version history
 */
router.get(
  '/:documentId/versions',
  ...orgAuth,
  validateSchema(documentSchemas.documentParam, 'params'),
  (req, res) => getController().getVersionHistory(req, res)
);

/**
 * POST /api/v2/documents/:documentId/versions
 * Upload new version (multipart/form-data)
 */
router.post(
  '/:documentId/versions',
  ...orgAuth,
  upload.single('file'),
  validateSchema(documentSchemas.documentParam, 'params'),
  validateSchema(documentSchemas.uploadVersion, 'body'),
  (req, res) => getController().uploadVersion(req, res)
);

export { router };
