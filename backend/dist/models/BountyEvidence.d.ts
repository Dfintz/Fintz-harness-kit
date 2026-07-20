import { BountyClaim } from './BountyClaim';
export declare enum EvidenceType {
    SCREENSHOT = "screenshot",
    VIDEO = "video",
    TEXT = "text",
    LINK = "link",
    FILE = "file"
}
export declare class BountyEvidence {
    id: string;
    claimId: string;
    claim?: BountyClaim;
    evidenceType: EvidenceType;
    content?: string;
    fileUrl?: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    submittedBy: string;
    submittedAt: Date;
    createdAt: Date;
    get isFile(): boolean;
    get isText(): boolean;
    get isLink(): boolean;
    get hasFile(): boolean;
}
//# sourceMappingURL=BountyEvidence.d.ts.map