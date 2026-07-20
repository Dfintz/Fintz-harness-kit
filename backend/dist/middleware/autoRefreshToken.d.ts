import { NextFunction, Response } from 'express';
import { UserSession } from '../models/UserSession';
import { AuthRequest } from './auth';
export declare const autoRefreshDiscordToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const shouldRefreshDiscordToken: (session: UserSession) => boolean;
export declare const refreshUserDiscordToken: (userId: number) => Promise<boolean>;
//# sourceMappingURL=autoRefreshToken.d.ts.map