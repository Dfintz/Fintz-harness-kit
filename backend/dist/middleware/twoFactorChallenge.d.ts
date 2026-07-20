import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
export interface TwoFactorChallengeConfig {
    codeHeader: string;
    requireEnabled: boolean;
    sensitiveActions: string[];
    skipForRoles?: string[];
    codeReuseWindow: number;
}
export declare const twoFactorChallengeMiddleware: (action: string, config?: Partial<TwoFactorChallengeConfig>) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const crossTenantAdmin2faChallenge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const gdprDeletion2faChallenge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const securitySettings2faChallenge: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=twoFactorChallenge.d.ts.map