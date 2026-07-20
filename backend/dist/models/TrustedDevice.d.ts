import { User } from './User';
export declare class TrustedDevice {
    id: string;
    userId: string;
    user?: User;
    deviceFingerprint: string;
    deviceName?: string;
    userAgent?: string;
    ipAddress?: string;
    location?: string;
    lastUsed: Date;
    isActive: boolean;
    trustLevel: 'low' | 'medium' | 'high';
    verificationMethod?: 'email' | '2fa' | 'sso';
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=TrustedDevice.d.ts.map