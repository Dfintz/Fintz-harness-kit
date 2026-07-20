import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class GdprController extends BaseController {
    private readonly consentService;
    private readonly deletionService;
    private readonly exportService;
    private readonly gdprExportStorage;
    private readonly organizationRepository;
    constructor();
    recordConsent: (req: AuthRequest, res: Response) => Promise<void>;
    getUserConsents: (req: AuthRequest, res: Response) => Promise<void>;
    requestDataExport: (req: AuthRequest, res: Response) => Promise<void>;
    getExportRequestStatus: (req: AuthRequest, res: Response) => Promise<void>;
    downloadExportFile: (req: AuthRequest, res: Response) => Promise<void>;
    getUserExportRequests: (req: AuthRequest, res: Response) => Promise<void>;
    exportUserData: (req: AuthRequest, res: Response) => Promise<void>;
    requestDataDeletion: (req: AuthRequest, res: Response) => Promise<void>;
    cancelDeletionRequest: (req: AuthRequest, res: Response) => Promise<void>;
    getDeletionStatus: (req: AuthRequest, res: Response) => Promise<void>;
    getConsentStatistics: (req: AuthRequest, res: Response) => Promise<void>;
    checkConsent: (req: AuthRequest, res: Response) => Promise<void>;
    checkConsentVersion: (req: AuthRequest, res: Response) => Promise<void>;
    getAdminGdprRequests: (req: AuthRequest, res: Response) => Promise<void>;
    getComplianceDashboard: (req: AuthRequest, res: Response) => Promise<void>;
    private calculateComplianceScore;
    private getComplianceRecommendations;
    verifyDeletionEmail: (req: AuthRequest, res: Response) => Promise<void>;
    resendDeletionConfirmation: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=gdprController.d.ts.map