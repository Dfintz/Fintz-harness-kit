import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export interface SecretsStatus {
    isConfigured: boolean;
    secretsLoaded: string[];
    lastRotation?: Record<string, Date>;
}
export declare class SecretsController extends BaseController {
    private secretsManager;
    constructor();
    getSecretsStatus: (req: AuthRequest, res: Response) => Promise<void>;
    checkSecretsRotation: (req: AuthRequest, res: Response) => Promise<void>;
    rotateJwtSecret: (req: AuthRequest, res: Response) => Promise<void>;
    rotateEncryptionKey: (req: AuthRequest, res: Response) => Promise<void>;
    rotateDbPassword: (req: AuthRequest, res: Response) => Promise<void>;
    reloadSecrets: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=secretsController.d.ts.map