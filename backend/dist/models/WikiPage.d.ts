import { TenantEntity } from './base/TenantEntity';
import { WikiPageRevision } from './WikiPageRevision';
export declare class WikiPage extends TenantEntity {
    id: string;
    title: string;
    slug: string;
    content: string;
    parentPageId: string | null;
    sortOrder: number;
    tags: string[];
    version: number;
    isLocked: boolean;
    createdBy: string;
    lastEditedBy: string | null;
    federationId: string | null;
    federationVisibility: string | null;
    revisions?: WikiPageRevision[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=WikiPage.d.ts.map