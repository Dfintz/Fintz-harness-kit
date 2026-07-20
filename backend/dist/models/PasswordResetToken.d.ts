import { User } from './User';
export declare class PasswordResetToken {
    id: string;
    userId: string;
    user: User;
    token: string;
    expiresAt: Date;
    used: boolean;
    createdAt: Date;
    isExpired(): boolean;
    markAsUsed(): void;
    isValid(): boolean;
}
//# sourceMappingURL=PasswordResetToken.d.ts.map