import { Document } from '../../models/Document';
import { DocumentFolder } from '../../models/DocumentFolder';
import { DocumentShare, SharePermission } from '../../models/DocumentShare';
import { DocumentVersion } from '../../models/DocumentVersion';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { TenantService } from '../base/TenantService';
export declare enum DocumentAuditAction {
    DOCUMENT_UPLOADED = "document_uploaded",
    DOCUMENT_UPDATED = "document_updated",
    DOCUMENT_DELETED = "document_deleted",
    DOCUMENT_DOWNLOADED = "document_downloaded",
    DOCUMENT_SHARED = "document_shared",
    VERSION_UPLOADED = "version_uploaded",
    FOLDER_CREATED = "folder_created",
    FOLDER_UPDATED = "folder_updated",
    FOLDER_DELETED = "folder_deleted"
}
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
export declare class DocumentService extends TenantService<Document> {
    private readonly folderRepository;
    private readonly versionRepository;
    private readonly shareRepository;
    private readonly documentStorage;
    constructor();
    private audit;
    uploadDocument(organizationId: string, userId: string, userName: string, dto: UploadDocumentDTO, fileBuffer: Buffer, mimeType: string): Promise<Document>;
    getDocumentById(organizationId: string, documentId: string): Promise<Document | null>;
    listDocuments(organizationId: string, pagination: PaginationOptions, filters?: DocumentSearchFilters): Promise<PaginatedResponse<Document>>;
    updateDocument(organizationId: string, documentId: string, userId: string, dto: UpdateDocumentDTO): Promise<Document>;
    deleteDocument(organizationId: string, documentId: string, userId: string): Promise<void>;
    getDownloadUrl(organizationId: string, documentId: string, userId: string): Promise<string>;
    uploadVersion(organizationId: string, documentId: string, userId: string, dto: UploadVersionDTO, fileBuffer: Buffer, mimeType: string): Promise<DocumentVersion>;
    getVersionHistory(organizationId: string, documentId: string): Promise<DocumentVersion[]>;
    shareDocument(organizationId: string, documentId: string, userId: string, dto: ShareDocumentDTO): Promise<DocumentShare>;
    getFolderTree(organizationId: string): Promise<DocumentFolder[]>;
    createFolder(organizationId: string, userId: string, dto: CreateFolderDTO): Promise<DocumentFolder>;
    updateFolder(organizationId: string, folderId: string, userId: string, dto: UpdateFolderDTO): Promise<DocumentFolder>;
    deleteFolder(organizationId: string, folderId: string, userId: string): Promise<void>;
    private calculateFolderDepth;
    cleanupDeletedDocuments(): Promise<number>;
}
//# sourceMappingURL=DocumentService.d.ts.map