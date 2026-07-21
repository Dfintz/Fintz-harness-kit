import { FindOptionsWhere, IsNull } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Document } from '../../models/Document';
import { DocumentFolder } from '../../models/DocumentFolder';
import { DocumentShare, SharePermission } from '../../models/DocumentShare';
import { DocumentVersion } from '../../models/DocumentVersion';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../../utils/auditLogger';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { emitToOrganization } from '../../websocket/websocketServer';
import { TenantService } from '../base/TenantService';
import { getDocumentStorageService } from '../cloud/DocumentStorageService';

// ==================== CONSTANTS ====================

const MAX_FOLDER_DEPTH = 3;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

// ==================== AUDIT ENUM ====================

export enum DocumentAuditAction {
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_UPDATED = 'document_updated',
  DOCUMENT_DELETED = 'document_deleted',
  DOCUMENT_DOWNLOADED = 'document_downloaded',
  DOCUMENT_SHARED = 'document_shared',
  VERSION_UPLOADED = 'version_uploaded',
  FOLDER_CREATED = 'folder_created',
  FOLDER_UPDATED = 'folder_updated',
  FOLDER_DELETED = 'folder_deleted',
}

// ==================== DTOs ====================

export interface UploadDocumentDTO {
  name: string;
  description?: string;
  folderId?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateDocumentDTO {
  name?: string;
  description?: string;
  folderId?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface CreateFolderDTO {
  name: string;
  parentId?: string;
}

export interface UpdateFolderDTO {
  name?: string;
  sortOrder?: number;
}

export interface ShareDocumentDTO {
  sharedWithUserId?: string;
  sharedWithRole?: string;
  permission: SharePermission;
  expiresAt?: string;
}

export interface DocumentSearchFilters {
  folderId?: string;
  mimeType?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface UploadVersionDTO {
  changeNote?: string;
}

// ==================== SERVICE ====================

/**
 * DocumentService
 *
 * Core service for organization document management.
 * Handles file upload, versioning, folder organization, sharing, and downloads.
 *
 * MULTI-TENANCY: Tenant-aware via TenantService base class.
 * STORAGE: Azure Blob Storage for file data.
 * AUDIT LOGGING: Full audit trail for all document operations.
 */
export class DocumentService extends TenantService<Document> {
  private readonly folderRepository = AppDataSource.getRepository(DocumentFolder);
  private readonly versionRepository = AppDataSource.getRepository(DocumentVersion);
  private readonly shareRepository = AppDataSource.getRepository(DocumentShare);
  private readonly documentStorage = getDocumentStorageService();

  constructor() {
    super(AppDataSource.getRepository(Document), {
      enableCache: true,
      cacheTTL: 300,
      cacheCheckPeriod: 60,
    });
  }

  // ==================== AUDIT HELPER ====================

  private audit(
    action: DocumentAuditAction,
    userId: string,
    organizationId: string,
    resourceId: string,
    details?: Record<string, unknown>
  ): void {
    try {
      logAuditEvent({
        eventType: action as unknown as AuditEventType,
        userId,
        message: `Document ${action}: ${resourceId}`,
        metadata: { organizationId, resourceId, ...details },
      });
    } catch (err: unknown) {
      logger.error('Failed to log document audit event', {
        action,
        resourceId,
        error: String(err),
      });
    }
  }

  // ==================== DOCUMENT CRUD ====================

  /**
   * Upload a new document
   */
  async uploadDocument(
    organizationId: string,
    userId: string,
    userName: string,
    dto: UploadDocumentDTO,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<Document> {
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
      );
    }

    // Validate folder if provided
    if (dto.folderId) {
      const folder = await this.folderRepository.findOne({
        where: { id: dto.folderId, organizationId },
      });
      if (!folder) {
        throw new NotFoundError('Folder');
      }
    }

    const documentRepository = AppDataSource.getRepository(Document);

    // Create document record
    const document = documentRepository.create({
      organizationId,
      name: dto.name,
      description: dto.description ?? undefined,
      folderId: dto.folderId ?? undefined,
      mimeType,
      fileSize: fileBuffer.length,
      blobPath: '', // Will be set after upload
      isPublic: dto.isPublic ?? false,
      tags: dto.tags ?? undefined,
      createdBy: userId,
    });

    const savedDocument = await documentRepository.save(document);

    // Upload to blob storage
    try {
      const { blobPath, sizeBytes } = await this.documentStorage.uploadDocument(
        organizationId,
        savedDocument.id,
        dto.folderId ?? null,
        1,
        fileBuffer,
        mimeType,
        dto.name
      );

      savedDocument.blobPath = blobPath;
      savedDocument.fileSize = sizeBytes;
      await documentRepository.save(savedDocument);

      // Create initial version record
      const version = this.versionRepository.create({
        documentId: savedDocument.id,
        version: 1,
        blobPath,
        fileSize: sizeBytes,
        uploadedBy: userId,
      });
      const savedVersion = await this.versionRepository.save(version);

      savedDocument.currentVersionId = savedVersion.id;
      await documentRepository.save(savedDocument);
    } catch (error: unknown) {
      // Clean up on upload failure
      await documentRepository.delete(savedDocument.id);
      throw error;
    }

    this.audit(DocumentAuditAction.DOCUMENT_UPLOADED, userId, organizationId, savedDocument.id, {
      name: dto.name,
      mimeType,
      fileSize: fileBuffer.length,
    });

    emitToOrganization(organizationId, 'document:uploaded', {
      documentId: savedDocument.id,
      name: dto.name,
      uploadedBy: userName,
    });

    return savedDocument;
  }

  /**
   * Get a document by ID
   */
  async getDocumentById(organizationId: string, documentId: string): Promise<Document | null> {
    return AppDataSource.getRepository(Document).findOne({
      where: { id: documentId, organizationId },
      relations: ['folder'],
    });
  }

  /**
   * List documents with pagination and filters
   */
  async listDocuments(
    organizationId: string,
    pagination: PaginationOptions,
    filters?: DocumentSearchFilters
  ): Promise<PaginatedResponse<Document>> {
    const where: FindOptionsWhere<Document> = { organizationId };

    if (filters?.folderId) {
      where.folderId = filters.folderId;
    } else if (filters?.folderId === undefined) {
      // Default: show root-level documents when no folder specified
    }

    if (filters?.mimeType) {
      where.mimeType = filters.mimeType;
    }

    return this.findAllPaginated(organizationId, pagination, where);
  }

  /**
   * Update document metadata
   */
  async updateDocument(
    organizationId: string,
    documentId: string,
    userId: string,
    dto: UpdateDocumentDTO
  ): Promise<Document> {
    const document = await this.getDocumentById(organizationId, documentId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    // Validate new folder if changing
    if (dto.folderId !== undefined && dto.folderId !== document.folderId) {
      if (dto.folderId) {
        const folder = await this.folderRepository.findOne({
          where: { id: dto.folderId, organizationId },
        });
        if (!folder) {
          throw new NotFoundError('Target folder');
        }
      }
    }

    const documentRepository = AppDataSource.getRepository(Document);

    if (dto.name !== undefined) {
      document.name = dto.name;
    }
    if (dto.description !== undefined) {
      document.description = dto.description;
    }
    if (dto.folderId !== undefined) {
      document.folderId = dto.folderId;
    }
    if (dto.tags !== undefined) {
      document.tags = dto.tags;
    }
    if (dto.isPublic !== undefined) {
      document.isPublic = dto.isPublic;
    }
    document.updatedBy = userId;

    const updated = await documentRepository.save(document);

    this.audit(
      DocumentAuditAction.DOCUMENT_UPDATED,
      userId,
      organizationId,
      documentId,
      dto as Record<string, unknown>
    );

    emitToOrganization(organizationId, 'document:updated', {
      documentId,
      changes: dto,
    });

    return updated;
  }

  /**
   * Soft-delete a document
   */
  async deleteDocument(organizationId: string, documentId: string, userId: string): Promise<void> {
    const document = await this.getDocumentById(organizationId, documentId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    const documentRepository = AppDataSource.getRepository(Document);
    await documentRepository.softRemove(document);

    this.audit(DocumentAuditAction.DOCUMENT_DELETED, userId, organizationId, documentId, {
      name: document.name,
    });

    emitToOrganization(organizationId, 'document:deleted', { documentId });
  }

  // ==================== DOWNLOAD ====================

  /**
   * Get download URL for a document
   */
  async getDownloadUrl(
    organizationId: string,
    documentId: string,
    userId: string
  ): Promise<string> {
    const document = await this.getDocumentById(organizationId, documentId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    // Increment download counter
    const documentRepository = AppDataSource.getRepository(Document);
    document.downloadCount += 1;
    await documentRepository.save(document);

    this.audit(DocumentAuditAction.DOCUMENT_DOWNLOADED, userId, organizationId, documentId, {
      name: document.name,
    });

    return this.documentStorage.generateDownloadUrl(document.blobPath);
  }

  // ==================== VERSIONING ====================

  /**
   * Upload a new version of a document
   */
  async uploadVersion(
    organizationId: string,
    documentId: string,
    userId: string,
    dto: UploadVersionDTO,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<DocumentVersion> {
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`
      );
    }

    const document = await this.getDocumentById(organizationId, documentId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    // Get latest version number
    const latestVersion = await this.versionRepository.findOne({
      where: { documentId },
      order: { version: 'DESC' },
    });
    const nextVersion = (latestVersion?.version ?? 0) + 1;

    // Upload file
    const { blobPath, sizeBytes } = await this.documentStorage.uploadDocument(
      organizationId,
      documentId,
      document.folderId ?? null,
      nextVersion,
      fileBuffer,
      mimeType,
      document.name
    );

    // Create version record
    const version = this.versionRepository.create({
      documentId,
      version: nextVersion,
      blobPath,
      fileSize: sizeBytes,
      changeNote: dto.changeNote,
      uploadedBy: userId,
    });
    const savedVersion = await this.versionRepository.save(version);

    // Update document with new version info
    const documentRepository = AppDataSource.getRepository(Document);
    document.currentVersionId = savedVersion.id;
    document.blobPath = blobPath;
    document.fileSize = sizeBytes;
    document.mimeType = mimeType;
    document.updatedBy = userId;
    await documentRepository.save(document);

    this.audit(DocumentAuditAction.VERSION_UPLOADED, userId, organizationId, documentId, {
      version: nextVersion,
      changeNote: dto.changeNote,
    });

    emitToOrganization(organizationId, 'document:version-uploaded', {
      documentId,
      version: nextVersion,
    });

    return savedVersion;
  }

  /**
   * Get version history for a document
   */
  async getVersionHistory(organizationId: string, documentId: string): Promise<DocumentVersion[]> {
    // Verify document belongs to org
    const document = await this.getDocumentById(organizationId, documentId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    return this.versionRepository.find({
      where: { documentId },
      order: { version: 'DESC' },
    });
  }

  // ==================== SHARING ====================

  /**
   * Share a document with a user or role
   */
  async shareDocument(
    organizationId: string,
    documentId: string,
    userId: string,
    dto: ShareDocumentDTO
  ): Promise<DocumentShare> {
    const document = await this.getDocumentById(organizationId, documentId);
    if (!document) {
      throw new NotFoundError('Document');
    }

    if (!dto.sharedWithUserId && !dto.sharedWithRole) {
      throw new ValidationError('Must specify either sharedWithUserId or sharedWithRole');
    }

    const share = this.shareRepository.create({
      documentId,
      sharedWithUserId: dto.sharedWithUserId,
      sharedWithRole: dto.sharedWithRole,
      permission: dto.permission,
      sharedBy: userId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    const savedShare = await this.shareRepository.save(share);

    this.audit(DocumentAuditAction.DOCUMENT_SHARED, userId, organizationId, documentId, {
      sharedWithUserId: dto.sharedWithUserId,
      sharedWithRole: dto.sharedWithRole,
      permission: dto.permission,
    });

    emitToOrganization(organizationId, 'document:shared', {
      documentId,
      shareId: savedShare.id,
    });

    return savedShare;
  }

  // ==================== FOLDERS ====================

  /**
   * Get folder tree for an organization
   */
  async getFolderTree(organizationId: string): Promise<DocumentFolder[]> {
    return this.folderRepository.find({
      where: { organizationId },
      relations: ['children'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Create a folder
   */
  async createFolder(
    organizationId: string,
    userId: string,
    dto: CreateFolderDTO
  ): Promise<DocumentFolder> {
    // Validate folder depth
    if (dto.parentId) {
      const depth = await this.calculateFolderDepth(organizationId, dto.parentId);
      if (depth >= MAX_FOLDER_DEPTH) {
        throw new ValidationError(`Maximum folder depth of ${MAX_FOLDER_DEPTH} levels exceeded`);
      }
    }

    // Check for duplicate names at same level
    const existing = await this.folderRepository.findOne({
      where: {
        organizationId,
        name: dto.name,
        parentId: dto.parentId ?? IsNull(),
      },
    });
    if (existing) {
      throw new ConflictError('A folder with this name already exists at this level');
    }

    const folder = this.folderRepository.create({
      organizationId,
      name: dto.name,
      parentId: dto.parentId,
      createdBy: userId,
    });

    const savedFolder = await this.folderRepository.save(folder);

    this.audit(DocumentAuditAction.FOLDER_CREATED, userId, organizationId, savedFolder.id, {
      name: dto.name,
      parentId: dto.parentId,
    });

    return savedFolder;
  }

  /**
   * Update a folder
   */
  async updateFolder(
    organizationId: string,
    folderId: string,
    userId: string,
    dto: UpdateFolderDTO
  ): Promise<DocumentFolder> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, organizationId },
    });
    if (!folder) {
      throw new NotFoundError('Folder');
    }

    if (dto.name !== undefined) {
      folder.name = dto.name;
    }
    if (dto.sortOrder !== undefined) {
      folder.sortOrder = dto.sortOrder;
    }

    const updated = await this.folderRepository.save(folder);

    this.audit(
      DocumentAuditAction.FOLDER_UPDATED,
      userId,
      organizationId,
      folderId,
      dto as Record<string, unknown>
    );

    return updated;
  }

  /**
   * Delete an empty folder
   */
  async deleteFolder(organizationId: string, folderId: string, userId: string): Promise<void> {
    const folder = await this.folderRepository.findOne({
      where: { id: folderId, organizationId },
    });
    if (!folder) {
      throw new NotFoundError('Folder');
    }

    // Check for child folders
    const childCount = await this.folderRepository.count({
      where: { parentId: folderId, organizationId },
    });
    if (childCount > 0) {
      throw new ConflictError('Cannot delete folder that contains subfolders');
    }

    // Check for documents in folder
    const documentCount = await AppDataSource.getRepository(Document).count({
      where: { folderId, organizationId },
    });
    if (documentCount > 0) {
      throw new ConflictError('Cannot delete folder that contains documents');
    }

    await this.folderRepository.remove(folder);

    this.audit(DocumentAuditAction.FOLDER_DELETED, userId, organizationId, folderId, {
      name: folder.name,
    });
  }

  // ==================== HELPERS ====================

  /**
   * Calculate depth of a folder in the hierarchy
   */
  private async calculateFolderDepth(organizationId: string, folderId: string): Promise<number> {
    let depth = 0;
    let currentId: string | undefined = folderId;

    while (currentId) {
      depth++;
      const folder = await this.folderRepository.findOne({
        where: { id: currentId, organizationId },
        select: ['id', 'parentId'],
      });
      currentId = folder?.parentId;
    }

    return depth;
  }

  /**
   * Cleanup soft-deleted documents past retention period (30 days)
   * Called by background job
   */
  async cleanupDeletedDocuments(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    const deletedDocs: unknown[] = await AppDataSource.query(
      `SELECT id, "organizationId", "blobPath" FROM "documents"
       WHERE "deletedAt" IS NOT NULL AND "deletedAt" < $1`,
      [cutoffDate.toISOString()]
    );

    let cleanedCount = 0;
    for (const row of deletedDocs) {
      const doc = row as { id: string; organizationId: string; blobPath: string };
      try {
        await this.documentStorage.deleteAllVersions(doc.organizationId, doc.id);
        await AppDataSource.query('DELETE FROM "documents" WHERE id = $1', [doc.id]);
        cleanedCount++;
      } catch (err: unknown) {
        logger.error('Failed to cleanup deleted document', {
          documentId: doc.id,
          error: String(err),
        });
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired deleted documents`);
    }

    return cleanedCount;
  }
}

