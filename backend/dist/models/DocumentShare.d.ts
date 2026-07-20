import { Document } from './Document';
export declare enum SharePermission {
    VIEW = "view",
    DOWNLOAD = "download",
    EDIT = "edit"
}
export declare class DocumentShare {
    id: string;
    documentId: string;
    sharedWithUserId?: string;
    sharedWithRole?: string;
    permission: SharePermission;
    sharedBy: string;
    expiresAt?: Date;
    document: Document;
    createdAt: Date;
    get isExpired(): boolean;
}
//# sourceMappingURL=DocumentShare.d.ts.map