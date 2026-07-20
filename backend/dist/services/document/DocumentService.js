"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = exports.DocumentAuditAction = void 0;
const typeorm_1 = require("typeorm");
const data_source_1 = require("../../data-source");
const Document_1 = require("../../models/Document");
const DocumentFolder_1 = require("../../models/DocumentFolder");
const DocumentShare_1 = require("../../models/DocumentShare");
const DocumentVersion_1 = require("../../models/DocumentVersion");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const websocketServer_1 = require("../../websocket/websocketServer");
const TenantService_1 = require("../base/TenantService");
const DocumentStorageService_1 = require("../cloud/DocumentStorageService");
const MAX_FOLDER_DEPTH = 3;
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
var DocumentAuditAction;
(function (DocumentAuditAction) {
    DocumentAuditAction["DOCUMENT_UPLOADED"] = "document_uploaded";
    DocumentAuditAction["DOCUMENT_UPDATED"] = "document_updated";
    DocumentAuditAction["DOCUMENT_DELETED"] = "document_deleted";
    DocumentAuditAction["DOCUMENT_DOWNLOADED"] = "document_downloaded";
    DocumentAuditAction["DOCUMENT_SHARED"] = "document_shared";
    DocumentAuditAction["VERSION_UPLOADED"] = "version_uploaded";
    DocumentAuditAction["FOLDER_CREATED"] = "folder_created";
    DocumentAuditAction["FOLDER_UPDATED"] = "folder_updated";
    DocumentAuditAction["FOLDER_DELETED"] = "folder_deleted";
})(DocumentAuditAction || (exports.DocumentAuditAction = DocumentAuditAction = {}));
class DocumentService extends TenantService_1.TenantService {
    folderRepository = data_source_1.AppDataSource.getRepository(DocumentFolder_1.DocumentFolder);
    versionRepository = data_source_1.AppDataSource.getRepository(DocumentVersion_1.DocumentVersion);
    shareRepository = data_source_1.AppDataSource.getRepository(DocumentShare_1.DocumentShare);
    documentStorage = (0, DocumentStorageService_1.getDocumentStorageService)();
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Document_1.Document), {
            enableCache: true,
            cacheTTL: 300,
            cacheCheckPeriod: 60,
        });
    }
    audit(action, userId, organizationId, resourceId, details) {
        try {
            (0, auditLogger_1.logAuditEvent)({
                eventType: action,
                userId,
                message: `Document ${action}: ${resourceId}`,
                metadata: { organizationId, resourceId, ...details },
            });
        }
        catch (err) {
            logger_1.logger.error('Failed to log document audit event', {
                action,
                resourceId,
                error: String(err),
            });
        }
    }
    async uploadDocument(organizationId, userId, userName, dto, fileBuffer, mimeType) {
        if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
            throw new apiErrors_1.ValidationError(`File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
        }
        if (dto.folderId) {
            const folder = await this.folderRepository.findOne({
                where: { id: dto.folderId, organizationId },
            });
            if (!folder) {
                throw new apiErrors_1.NotFoundError('Folder');
            }
        }
        const documentRepository = data_source_1.AppDataSource.getRepository(Document_1.Document);
        const document = documentRepository.create({
            organizationId,
            name: dto.name,
            description: dto.description ?? undefined,
            folderId: dto.folderId ?? undefined,
            mimeType,
            fileSize: fileBuffer.length,
            blobPath: '',
            isPublic: dto.isPublic ?? false,
            tags: dto.tags ?? undefined,
            createdBy: userId,
        });
        const savedDocument = await documentRepository.save(document);
        try {
            const { blobPath, sizeBytes } = await this.documentStorage.uploadDocument(organizationId, savedDocument.id, dto.folderId ?? null, 1, fileBuffer, mimeType, dto.name);
            savedDocument.blobPath = blobPath;
            savedDocument.fileSize = sizeBytes;
            await documentRepository.save(savedDocument);
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
        }
        catch (error) {
            await documentRepository.delete(savedDocument.id);
            throw error;
        }
        this.audit(DocumentAuditAction.DOCUMENT_UPLOADED, userId, organizationId, savedDocument.id, {
            name: dto.name,
            mimeType,
            fileSize: fileBuffer.length,
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'document:uploaded', {
            documentId: savedDocument.id,
            name: dto.name,
            uploadedBy: userName,
        });
        return savedDocument;
    }
    async getDocumentById(organizationId, documentId) {
        return data_source_1.AppDataSource.getRepository(Document_1.Document).findOne({
            where: { id: documentId, organizationId },
            relations: ['folder'],
        });
    }
    async listDocuments(organizationId, pagination, filters) {
        const where = { organizationId };
        if (filters?.folderId) {
            where.folderId = filters.folderId;
        }
        else if (filters?.folderId === undefined) {
        }
        if (filters?.mimeType) {
            where.mimeType = filters.mimeType;
        }
        return this.findAllPaginated(organizationId, pagination, where);
    }
    async updateDocument(organizationId, documentId, userId, dto) {
        const document = await this.getDocumentById(organizationId, documentId);
        if (!document) {
            throw new apiErrors_1.NotFoundError('Document');
        }
        if (dto.folderId !== undefined && dto.folderId !== document.folderId) {
            if (dto.folderId) {
                const folder = await this.folderRepository.findOne({
                    where: { id: dto.folderId, organizationId },
                });
                if (!folder) {
                    throw new apiErrors_1.NotFoundError('Target folder');
                }
            }
        }
        const documentRepository = data_source_1.AppDataSource.getRepository(Document_1.Document);
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
        this.audit(DocumentAuditAction.DOCUMENT_UPDATED, userId, organizationId, documentId, dto);
        (0, websocketServer_1.emitToOrganization)(organizationId, 'document:updated', {
            documentId,
            changes: dto,
        });
        return updated;
    }
    async deleteDocument(organizationId, documentId, userId) {
        const document = await this.getDocumentById(organizationId, documentId);
        if (!document) {
            throw new apiErrors_1.NotFoundError('Document');
        }
        const documentRepository = data_source_1.AppDataSource.getRepository(Document_1.Document);
        await documentRepository.softRemove(document);
        this.audit(DocumentAuditAction.DOCUMENT_DELETED, userId, organizationId, documentId, {
            name: document.name,
        });
        (0, websocketServer_1.emitToOrganization)(organizationId, 'document:deleted', { documentId });
    }
    async getDownloadUrl(organizationId, documentId, userId) {
        const document = await this.getDocumentById(organizationId, documentId);
        if (!document) {
            throw new apiErrors_1.NotFoundError('Document');
        }
        const documentRepository = data_source_1.AppDataSource.getRepository(Document_1.Document);
        document.downloadCount += 1;
        await documentRepository.save(document);
        this.audit(DocumentAuditAction.DOCUMENT_DOWNLOADED, userId, organizationId, documentId, {
            name: document.name,
        });
        return this.documentStorage.generateDownloadUrl(document.blobPath);
    }
    async uploadVersion(organizationId, documentId, userId, dto, fileBuffer, mimeType) {
        if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
            throw new apiErrors_1.ValidationError(`File size exceeds maximum of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB`);
        }
        const document = await this.getDocumentById(organizationId, documentId);
        if (!document) {
            throw new apiErrors_1.NotFoundError('Document');
        }
        const latestVersion = await this.versionRepository.findOne({
            where: { documentId },
            order: { version: 'DESC' },
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;
        const { blobPath, sizeBytes } = await this.documentStorage.uploadDocument(organizationId, documentId, document.folderId ?? null, nextVersion, fileBuffer, mimeType, document.name);
        const version = this.versionRepository.create({
            documentId,
            version: nextVersion,
            blobPath,
            fileSize: sizeBytes,
            changeNote: dto.changeNote,
            uploadedBy: userId,
        });
        const savedVersion = await this.versionRepository.save(version);
        const documentRepository = data_source_1.AppDataSource.getRepository(Document_1.Document);
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
        (0, websocketServer_1.emitToOrganization)(organizationId, 'document:version-uploaded', {
            documentId,
            version: nextVersion,
        });
        return savedVersion;
    }
    async getVersionHistory(organizationId, documentId) {
        const document = await this.getDocumentById(organizationId, documentId);
        if (!document) {
            throw new apiErrors_1.NotFoundError('Document');
        }
        return this.versionRepository.find({
            where: { documentId },
            order: { version: 'DESC' },
        });
    }
    async shareDocument(organizationId, documentId, userId, dto) {
        const document = await this.getDocumentById(organizationId, documentId);
        if (!document) {
            throw new apiErrors_1.NotFoundError('Document');
        }
        if (!dto.sharedWithUserId && !dto.sharedWithRole) {
            throw new apiErrors_1.ValidationError('Must specify either sharedWithUserId or sharedWithRole');
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
        (0, websocketServer_1.emitToOrganization)(organizationId, 'document:shared', {
            documentId,
            shareId: savedShare.id,
        });
        return savedShare;
    }
    async getFolderTree(organizationId) {
        return this.folderRepository.find({
            where: { organizationId },
            relations: ['children'],
            order: { sortOrder: 'ASC', name: 'ASC' },
        });
    }
    async createFolder(organizationId, userId, dto) {
        if (dto.parentId) {
            const depth = await this.calculateFolderDepth(organizationId, dto.parentId);
            if (depth >= MAX_FOLDER_DEPTH) {
                throw new apiErrors_1.ValidationError(`Maximum folder depth of ${MAX_FOLDER_DEPTH} levels exceeded`);
            }
        }
        const existing = await this.folderRepository.findOne({
            where: {
                organizationId,
                name: dto.name,
                parentId: dto.parentId ?? (0, typeorm_1.IsNull)(),
            },
        });
        if (existing) {
            throw new apiErrors_1.ConflictError('A folder with this name already exists at this level');
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
    async updateFolder(organizationId, folderId, userId, dto) {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId, organizationId },
        });
        if (!folder) {
            throw new apiErrors_1.NotFoundError('Folder');
        }
        if (dto.name !== undefined) {
            folder.name = dto.name;
        }
        if (dto.sortOrder !== undefined) {
            folder.sortOrder = dto.sortOrder;
        }
        const updated = await this.folderRepository.save(folder);
        this.audit(DocumentAuditAction.FOLDER_UPDATED, userId, organizationId, folderId, dto);
        return updated;
    }
    async deleteFolder(organizationId, folderId, userId) {
        const folder = await this.folderRepository.findOne({
            where: { id: folderId, organizationId },
        });
        if (!folder) {
            throw new apiErrors_1.NotFoundError('Folder');
        }
        const childCount = await this.folderRepository.count({
            where: { parentId: folderId, organizationId },
        });
        if (childCount > 0) {
            throw new apiErrors_1.ConflictError('Cannot delete folder that contains subfolders');
        }
        const documentCount = await data_source_1.AppDataSource.getRepository(Document_1.Document).count({
            where: { folderId, organizationId },
        });
        if (documentCount > 0) {
            throw new apiErrors_1.ConflictError('Cannot delete folder that contains documents');
        }
        await this.folderRepository.remove(folder);
        this.audit(DocumentAuditAction.FOLDER_DELETED, userId, organizationId, folderId, {
            name: folder.name,
        });
    }
    async calculateFolderDepth(organizationId, folderId) {
        let depth = 0;
        let currentId = folderId;
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
    async cleanupDeletedDocuments() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const deletedDocs = await data_source_1.AppDataSource.query(`SELECT id, "organizationId", "blobPath" FROM "documents"
       WHERE "deletedAt" IS NOT NULL AND "deletedAt" < $1`, [cutoffDate.toISOString()]);
        let cleanedCount = 0;
        for (const row of deletedDocs) {
            const doc = row;
            try {
                await this.documentStorage.deleteAllVersions(doc.organizationId, doc.id);
                await data_source_1.AppDataSource.query('DELETE FROM "documents" WHERE id = $1', [doc.id]);
                cleanedCount++;
            }
            catch (err) {
                logger_1.logger.error('Failed to cleanup deleted document', {
                    documentId: doc.id,
                    error: String(err),
                });
            }
        }
        if (cleanedCount > 0) {
            logger_1.logger.info(`Cleaned up ${cleanedCount} expired deleted documents`);
        }
        return cleanedCount;
    }
}
exports.DocumentService = DocumentService;
//# sourceMappingURL=DocumentService.js.map