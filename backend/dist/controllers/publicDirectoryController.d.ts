import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class PublicDirectoryController extends BaseController {
    private readonly directoryService;
    private readonly federationService;
    private readonly permissionService;
    private readonly memberService;
    private readonly seoService;
    private parseStringArray;
    private buildDirectoryFilters;
    getDirectory: (req: AuthRequest, res: Response) => Promise<void>;
    getPublicProfile: (req: AuthRequest, res: Response) => Promise<void>;
    getDirectoryStats: (req: AuthRequest, res: Response) => Promise<void>;
    getFilterOptions: (req: AuthRequest, res: Response) => Promise<void>;
    getPublicFederations: (req: AuthRequest, res: Response) => Promise<void>;
    getPublicFederation: (req: AuthRequest, res: Response) => Promise<void>;
    getPublicFederationStats: (req: AuthRequest, res: Response) => Promise<void>;
    getOwnProfile: (req: AuthRequest, res: Response) => Promise<void>;
    updateOwnProfile: (req: AuthRequest, res: Response) => Promise<void>;
    syncFromRsi: (req: AuthRequest, res: Response) => Promise<void>;
    setVerificationStatus: (req: AuthRequest, res: Response) => Promise<void>;
    getDirectorySeoMeta: (req: AuthRequest, res: Response) => Promise<void>;
    getOrganizationSeoMeta: (req: AuthRequest, res: Response) => Promise<void>;
    getFederationSeoMeta: (req: AuthRequest, res: Response) => Promise<void>;
    getSitemap: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=publicDirectoryController.d.ts.map