import { Federation } from './Federation';
export type FederationIntelClassification = 'open' | 'restricted' | 'secret';
export type FederationIntelStatus = 'draft' | 'pending_review' | 'published' | 'archived';
export declare class FederationIntelEntry {
    id: string;
    federationId: string;
    federation?: Federation;
    title: string;
    content: string;
    classification: FederationIntelClassification;
    status: FederationIntelStatus;
    submittedBy: string;
    submittedByName: string | null;
    submittedByOrgId: string | null;
    approvedBy: string | null;
    tags: string[];
    visibleToTreaties: string[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=FederationIntelEntry.d.ts.map