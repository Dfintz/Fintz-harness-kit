import { TenantEntity } from './base/TenantEntity';
import type { DocumentFolder } from './DocumentFolder';
import type { DocumentShare } from './DocumentShare';
import type { DocumentVersion } from './DocumentVersion';
export declare class Document extends TenantEntity {
    id: string;
    name: string;
    description?: string;
    folderId?: string;
    mimeType: string;
    fileSize: number;
    blobPath: string;
    currentVersionId?: string;
    downloadCount: number;
    isPublic: boolean;
    tags?: string[];
    createdBy: string;
    updatedBy?: string;
    folder?: DocumentFolder;
    versions?: DocumentVersion[];
    shares?: DocumentShare[];
    createdAt: Date;
    updatedAt: Date;
    version: number;
    get isImage(): boolean;
    get isPdf(): boolean;
    get fileSizeMb(): number;
}
//# sourceMappingURL=Document.d.ts.map