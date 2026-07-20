import { User } from './User';
export declare class PasswordlessToken {
    id: string;
    userId?: string;
    user?: User;
    email: string;
    tokenHash: string;
    shortCode?: string;
    tokenType: 'magic_link' | 'code';
    expiresAt: Date;
    used: boolean;
    usedAt?: Date;
    attempts: number;
    maxAttempts: number;
    requestIp?: string;
    requestUserAgent?: string;
    verifyIp?: string;
    verifyUserAgent?: string;
    purpose: 'login' | 'register' | 'link_account' | 'verify_email';
    createdAt: Date;
    isExpired(): boolean;
    isLocked(): boolean;
    isValid(): boolean;
}
//# sourceMappingURL=PasswordlessToken.d.ts.map