import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class RecruitmentController extends BaseController {
    private readonly activityService;
    private readonly orgApplicationService;
    private readonly permissionService;
    constructor();
    private requireApplicationReviewAccess;
    private mapToActivityStatus;
    private mapToFrontendStatus;
    private transformToRecruitment;
    private getDiscordRecruitmentSettings;
    private getOrgLogoUrl;
    private getOrgLogoUrls;
    listRecruitments: (req: AuthRequest, res: Response) => Promise<void>;
    createRecruitment: (req: AuthRequest, res: Response) => Promise<void>;
    getRecruitment: (req: AuthRequest, res: Response) => Promise<void>;
    updateRecruitment: (req: AuthRequest, res: Response) => Promise<void>;
    deleteRecruitment: (req: AuthRequest, res: Response) => Promise<void>;
    updateStatus: (req: AuthRequest, res: Response) => Promise<void>;
    submitApplication: (req: AuthRequest, res: Response) => Promise<void>;
    listApplications: (req: AuthRequest, res: Response) => Promise<void>;
    private enrichApplicationsWithProfile;
    reviewApplication: (req: AuthRequest, res: Response) => Promise<void>;
    getMyApplications: (req: AuthRequest, res: Response) => Promise<void>;
    createInviteBinding: (req: AuthRequest, res: Response) => Promise<void>;
    discordApply: (req: AuthRequest, res: Response) => Promise<void>;
    private mapVisibility;
    private mapApplicationStatus;
    private extractUpdateFields;
}
//# sourceMappingURL=recruitmentController.d.ts.map