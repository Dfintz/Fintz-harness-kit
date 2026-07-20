import { User } from './User';
export declare enum ConsentType {
    ESSENTIAL = "essential",
    ANALYTICS = "analytics",
    MARKETING = "marketing",
    THIRD_PARTY = "third_party",
    DATA_PROCESSING = "data_processing"
}
export declare class UserConsent {
    id: string;
    userId: string;
    user: User;
    consentType: ConsentType;
    granted: boolean;
    purpose?: string;
    version?: string;
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
    updatedAt: Date;
    expiresAt?: Date;
}
//# sourceMappingURL=UserConsent.d.ts.map