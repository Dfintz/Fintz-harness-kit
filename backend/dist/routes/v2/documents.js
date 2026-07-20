"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const documentController_1 = require("../../controllers/documentController");
const auth_1 = require("../../middleware/auth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const tenantContext_1 = require("../../middleware/tenantContext");
const documentSchemas_1 = require("../../schemas/documentSchemas");
const router = (0, express_1.Router)();
exports.router = router;
let documentController;
const getController = () => {
    if (!documentController) {
        documentController = new documentController_1.DocumentController();
    }
    return documentController;
};
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const DANGEROUS_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.dll', '.so', '.dylib']);
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (_req, file, cb) => {
        const ext = file.originalname.toLowerCase().split('.').pop() ?? '';
        if (DANGEROUS_EXTENSIONS.has(`.${ext}`)) {
            return cb(new Error('Executable files are not allowed.'));
        }
        cb(null, true);
    },
});
const orgAuth = [auth_1.authenticate, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext];
router.get('/folders', ...orgAuth, (req, res) => getController().getFolderTree(req, res));
router.post('/folders', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.createFolder, 'body'), (req, res) => getController().createFolder(req, res));
router.put('/folders/:folderId', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.folderParam, 'params'), (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.updateFolder, 'body'), (req, res) => getController().updateFolder(req, res));
router.delete('/folders/:folderId', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.folderParam, 'params'), (req, res) => getController().deleteFolder(req, res));
router.get('/', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.query, 'query'), (req, res) => getController().listDocuments(req, res));
router.post('/', ...orgAuth, upload.single('file'), (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.upload, 'body'), (req, res) => getController().uploadDocument(req, res));
router.get('/:documentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (req, res) => getController().getDocument(req, res));
router.put('/:documentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.update, 'body'), (req, res) => getController().updateDocument(req, res));
router.delete('/:documentId', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (req, res) => getController().deleteDocument(req, res));
router.get('/:documentId/download', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (req, res) => getController().downloadDocument(req, res));
router.post('/:documentId/share', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.share, 'body'), (req, res) => getController().shareDocument(req, res));
router.get('/:documentId/versions', ...orgAuth, (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (req, res) => getController().getVersionHistory(req, res));
router.post('/:documentId/versions', ...orgAuth, upload.single('file'), (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.documentParam, 'params'), (0, schemaValidation_1.validateSchema)(documentSchemas_1.documentSchemas.uploadVersion, 'body'), (req, res) => getController().uploadVersion(req, res));
//# sourceMappingURL=documents.js.map