import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import {
  CreateFolderDTO,
  DocumentSearchFilters,
  DocumentService,
  ShareDocumentDTO,
  UpdateDocumentDTO,
  UpdateFolderDTO,
  UploadDocumentDTO,
  UploadVersionDTO,
} from '../services/document/DocumentService';
import { NotFoundError, ValidationError } from '../utils/apiErrors';

import { BaseController } from './BaseController';

/**
 * Helper function to parse pagination parameters
 */
function parsePagination(
  query: AuthRequest['query'],
  defaults?: { page: number; limit: number }
): { page: number; limit: number } {
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

/**
 * Document Controller
 *
 * Provides /api/v2/documents endpoints for file management, versioning,
 * folders, and sharing.
 */
export class DocumentController extends BaseController {
  private readonly documentService: DocumentService;

  constructor() {
    super();
    this.documentService = new DocumentService();
  }

  // ==================== LIST DOCUMENTS ====================

  listDocuments = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const { page, limit } = parsePagination(req.query);

      const filters: DocumentSearchFilters = {};
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
        filters.sortOrder = req.query.sortOrder as DocumentSearchFilters['sortOrder'];
      }

      const result = await this.documentService.listDocuments(
        organizationId,
        { page, limit },
        filters
      );

      res.json({
        data: result.data,
        pagination: result.pagination,
      });
    });
  };

  // ==================== UPLOAD DOCUMENT ====================

  uploadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const username = req.user?.username ?? 'Unknown';

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const file = req.file;
      if (!file) {
        throw new ValidationError('File is required');
      }

      const dto = req.body as UploadDocumentDTO;
      const document = await this.documentService.uploadDocument(
        organizationId,
        userId,
        username,
        dto,
        file.buffer,
        file.mimetype
      );

      res.status(201).json(document);
    });
  };

  // ==================== GET DOCUMENT ====================

  getDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const documentId = req.params.documentId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const document = await this.documentService.getDocumentById(organizationId, documentId);
      if (!document) {
        throw new NotFoundError('Document');
      }

      res.json(document);
    });
  };

  // ==================== UPDATE DOCUMENT ====================

  updateDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const documentId = req.params.documentId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const dto = req.body as UpdateDocumentDTO;
      const updated = await this.documentService.updateDocument(
        organizationId,
        documentId,
        userId,
        dto
      );

      res.json(updated);
    });
  };

  // ==================== DELETE DOCUMENT ====================

  deleteDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const documentId = req.params.documentId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      await this.documentService.deleteDocument(organizationId, documentId, userId);

      res.status(204).send();
    });
  };

  // ==================== DOWNLOAD DOCUMENT ====================

  downloadDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const documentId = req.params.documentId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const downloadUrl = await this.documentService.getDownloadUrl(
        organizationId,
        documentId,
        userId
      );

      res.json({ downloadUrl });
    });
  };

  // ==================== SHARE DOCUMENT ====================

  shareDocument = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const documentId = req.params.documentId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const dto = req.body as ShareDocumentDTO;
      const share = await this.documentService.shareDocument(
        organizationId,
        documentId,
        userId,
        dto
      );

      res.status(201).json(share);
    });
  };

  // ==================== UPLOAD VERSION ====================

  uploadVersion = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const documentId = req.params.documentId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const file = req.file;
      if (!file) {
        throw new ValidationError('File is required');
      }

      const dto = req.body as UploadVersionDTO;
      const version = await this.documentService.uploadVersion(
        organizationId,
        documentId,
        userId,
        dto,
        file.buffer,
        file.mimetype
      );

      res.status(201).json(version);
    });
  };

  // ==================== GET VERSION HISTORY ====================

  getVersionHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const documentId = req.params.documentId;

      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const versions = await this.documentService.getVersionHistory(organizationId, documentId);

      res.json(versions);
    });
  };

  // ==================== GET FOLDER TREE ====================

  getFolderTree = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      if (!organizationId) {
        throw new ValidationError('Organization context required');
      }

      const folders = await this.documentService.getFolderTree(organizationId);

      res.json(folders);
    });
  };

  // ==================== CREATE FOLDER ====================

  createFolder = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const dto = req.body as CreateFolderDTO;
      const folder = await this.documentService.createFolder(organizationId, userId, dto);

      res.status(201).json(folder);
    });
  };

  // ==================== UPDATE FOLDER ====================

  updateFolder = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const folderId = req.params.folderId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      const dto = req.body as UpdateFolderDTO;
      const folder = await this.documentService.updateFolder(organizationId, folderId, userId, dto);

      res.json(folder);
    });
  };

  // ==================== DELETE FOLDER ====================

  deleteFolder = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const organizationId = req.user?.currentOrganizationId;
      const userId = req.user?.id;
      const folderId = req.params.folderId;

      if (!organizationId || !userId) {
        throw new ValidationError('Organization context and user ID required');
      }

      await this.documentService.deleteFolder(organizationId, folderId, userId);

      res.status(204).send();
    });
  };
}
