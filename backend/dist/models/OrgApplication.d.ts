import { Organization } from './Organization';
import { User } from './User';
export declare enum ApplicationTargetType {
    ORGANIZATION = "organization",
    ALLIANCE = "alliance",
    FEDERATION = "federation"
}
export declare enum ApplicantType {
    USER = "user",
    ORGANIZATION = "organization"
}
export declare enum OrgApplicationStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    WITHDRAWN = "withdrawn"
}
export { OrgApplicationStatus as ApplicationStatus };
export declare class OrgApplication {
    id: string;
    targetType: ApplicationTargetType;
    applicantType: ApplicantType;
    organizationId: string;
    organization?: Organization;
    applicantUserId: string;
    applicant?: User;
    status: OrgApplicationStatus;
    message?: string;
    formResponses?: Record<string, string>;
    source?: 'web' | 'discord' | 'api';
    applicantOrgId?: string;
    applicantOrgName?: string;
    reviewedBy?: string;
    reviewer?: User;
    reviewNote?: string;
    reviewedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export { OrgApplication as Application };
//# sourceMappingURL=OrgApplication.d.ts.map