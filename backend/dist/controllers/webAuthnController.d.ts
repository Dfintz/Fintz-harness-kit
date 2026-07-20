import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
export declare class WebAuthnController {
    private readonly webAuthnService;
    private readonly authService;
    private readonly userService;
    private readonly twoFactorService;
    constructor();
    getCredentials(req: AuthRequest, res: Response): Promise<void>;
    startRegistration(req: AuthRequest, res: Response): Promise<void>;
    completeRegistration(req: AuthRequest, res: Response): Promise<void>;
    updateCredential(req: AuthRequest, res: Response): Promise<void>;
    removeCredential(req: AuthRequest, res: Response): Promise<void>;
    checkSupport(_req: AuthRequest, res: Response): Promise<void>;
    getAuthenticationOptions(req: Request, res: Response): Promise<void>;
    verifyAuthentication(req: Request, res: Response): Promise<void>;
    getStepUpOptions(req: AuthRequest, res: Response): Promise<void>;
    verifyStepUp(req: AuthRequest, res: Response): Promise<void>;
    mobileAuthenticate(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=webAuthnController.d.ts.map