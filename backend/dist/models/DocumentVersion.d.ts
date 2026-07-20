import { Document } from './Document';
export declare class DocumentVersion {
    id: string;
    documentId: string;
    version: number;
    blobPath: string;
    fileSize: number;
    changeNote?: string;
    uploadedBy: string;
    document: Document;
    createdAt: Date;
}
//# sourceMappingURL=DocumentVersion.d.ts.map