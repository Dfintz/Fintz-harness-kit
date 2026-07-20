"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentController = void 0;
const DocumentService_1 = require("../services/document/DocumentService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
function parsePagination(query, defaults) {
    const MAX_LIMIT = 100;
    const defaultPage = defaults?.page ?? 1;
    const defaultLimit = defaults?.limit ?? 20;
    const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
    const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
    const parsedPage = typeof rawPage === 'string' ? Number.parseInt(rawPage, 10) : Number.NaN;
    const parsedLimit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : Number.NaN;
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
    let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
    if (limit > MAX_LIMIT) {
        limit = MAX_LIMIT;
    }
    return { page, limit };
}
class DocumentController extends BaseController_1.BaseController {
    documentService;
    constructor() {
        super();
        this.documentService = new DocumentService_1.DocumentService();
    }
    listDocuments = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { page, limit } = parsePagination(req.query);
            const filters = {};
            if (req.query.folderId) {
                filters.folderId =
                    typeof req.query.folderId === 'string' ? req.query.folderId : String(req.query.folderId);
            }
            if (req.query.mimeType) {
                filters.mimeType =
                    typeof req.query.mimeType === 'string' ? req.query.mimeType : String(req.query.mimeType);
            }
            if (req.query.search) {
                filters.search =
                    typeof req.query.search === 'string' ? req.query.search : String(req.query.search);
            }
            if (req.query.sortBy) {
                filters.sortBy =
                    typeof req.query.sortBy === 'string' ? req.query.sortBy : String(req.query.sortBy);
            }
            if (req.query.sortOrder) {
                filters.sortOrder = req.query.sortOrder;
            }
            const result = await this.documentService.listDocuments(organizationId, { page, limit }, filters);
            res.json({
                data: result.data,
                pagination: result.pagination,
            });
        });
    };
    uploadDocument = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const username = req.user?.username ?? 'Unknown';
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const file = req.file;
            if (!file) {
                throw new apiErrors_1.ValidationError('File is required');
            }
            const dto = req.body;
            const document = await this.documentService.uploadDocument(organizationId, userId, username, dto, file.buffer, file.mimetype);
            res.status(201).json(document);
        });
    };
    getDocument = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const documentId = req.params.documentId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const document = await this.documentService.getDocumentById(organizationId, documentId);
            if (!document) {
                throw new apiErrors_1.NotFoundError('Document');
            }
            res.json(document);
        });
    };
    updateDocument = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const documentId = req.params.documentId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const dto = req.body;
            const updated = await this.documentService.updateDocument(organizationId, documentId, userId, dto);
            res.json(updated);
        });
    };
    deleteDocument = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const documentId = req.params.documentId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            await this.documentService.deleteDocument(organizationId, documentId, userId);
            res.status(204).send();
        });
    };
    downloadDocument = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const documentId = req.params.documentId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const downloadUrl = await this.documentService.getDownloadUrl(organizationId, documentId, userId);
            res.json({ downloadUrl });
        });
    };
    shareDocument = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const documentId = req.params.documentId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const dto = req.body;
            const share = await this.documentService.shareDocument(organizationId, documentId, userId, dto);
            res.status(201).json(share);
        });
    };
    uploadVersion = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const documentId = req.params.documentId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const file = req.file;
            if (!file) {
                throw new apiErrors_1.ValidationError('File is required');
            }
            const dto = req.body;
            const version = await this.documentService.uploadVersion(organizationId, documentId, userId, dto, file.buffer, file.mimetype);
            res.status(201).json(version);
        });
    };
    getVersionHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const documentId = req.params.documentId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const versions = await this.documentService.getVersionHistory(organizationId, documentId);
            res.json(versions);
        });
    };
    getFolderTree = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const folders = await this.documentService.getFolderTree(organizationId);
            res.json(folders);
        });
    };
    createFolder = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const dto = req.body;
            const folder = await this.documentService.createFolder(organizationId, userId, dto);
            res.status(201).json(folder);
        });
    };
    updateFolder = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const folderId = req.params.folderId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const dto = req.body;
            const folder = await this.documentService.updateFolder(organizationId, folderId, userId, dto);
            res.json(folder);
        });
    };
    deleteFolder = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            const folderId = req.params.folderId;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            await this.documentService.deleteFolder(organizationId, folderId, userId);
            res.status(204).send();
        });
    };
}
exports.DocumentController = DocumentController;
//# sourceMappingURL=documentController.js.map