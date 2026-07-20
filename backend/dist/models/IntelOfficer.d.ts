import { IntelAccessLevel } from './IntelEntry';
import { Organization } from './Organization';
import { User } from './User';
export declare enum IntelOfficerRank {
    JUNIOR = "junior",
    OFFICER = "officer",
    SENIOR = "senior",
    LEAD = "lead",
    CHIEF = "chief"
}
export declare class IntelOfficer {
    id: string;
    organizationId: string;
    organization?: Organization;
    userId: string;
    user?: User;
    rank: IntelOfficerRank;
    accessLevel: IntelAccessLevel;
    isActive: boolean;
    specializations?: string;
    appointedBy: string;
    appointer?: User;
    revokedBy?: string;
    revoker?: User;
    revokedAt?: Date;
    notes?: string;
    appointedAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=IntelOfficer.d.ts.map