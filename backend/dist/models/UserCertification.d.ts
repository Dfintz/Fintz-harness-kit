import { Certification } from './Certification';
export declare enum CertificationStatus {
    ACTIVE = "active",
    REVOKED = "revoked",
    EXPIRED = "expired"
}
export declare class UserCertification {
    id: string;
    organizationId: string;
    userId: string;
    certificationId: string;
    certification?: Certification;
    status: CertificationStatus;
    awardedBy: string;
    awardedAt: Date;
    revokedBy?: string;
    revokedAt?: Date;
    revokeReason?: string;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=UserCertification.d.ts.map