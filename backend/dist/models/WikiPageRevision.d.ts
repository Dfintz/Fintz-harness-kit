import { WikiPage } from './WikiPage';
export declare class WikiPageRevision {
    id: string;
    pageId: string;
    page: WikiPage;
    content: string;
    editedBy: string;
    changeDescription: string | null;
    version: number;
    editedAt: Date;
}
//# sourceMappingURL=WikiPageRevision.d.ts.map