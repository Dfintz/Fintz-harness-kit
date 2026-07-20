import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class CertificationController extends BaseController {
    private readonly certificationService;
    constructor();
    listCertifications: (req: AuthRequest, res: Response) => Promise<void>;
    getCertification: (req: AuthRequest, res: Response) => Promise<void>;
    createCertification: (req: AuthRequest, res: Response) => Promise<void>;
    updateCertification: (req: AuthRequest, res: Response) => Promise<void>;
    deleteCertification: (req: AuthRequest, res: Response) => Promise<void>;
    awardCertification: (req: AuthRequest, res: Response) => Promise<void>;
    revokeCertification: (req: AuthRequest, res: Response) => Promise<void>;
    getUserCertifications: (req: AuthRequest, res: Response) => Promise<void>;
    getCertificationHolders: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=certificationController.d.ts.map