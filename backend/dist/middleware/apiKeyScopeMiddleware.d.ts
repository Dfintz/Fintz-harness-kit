import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
export declare const requireScope: (required: string, phaseRequired?: number) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const __setApiKeyScopePhaseForTests: (phase: number) => void;
export declare const __resetApiKeyScopePhaseForTests: () => void;
//# sourceMappingURL=apiKeyScopeMiddleware.d.ts.map