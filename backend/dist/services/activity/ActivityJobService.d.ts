import { Activity, ActivityApplication, ApplicationStatus, ContractorRequirements, ContractorScreeningResult } from '../../models/Activity';
import { TenantService } from '../base/TenantService';
export interface JobApplicationDTO {
    userId: string;
    userName: string;
    organizationId?: string;
    organizationName?: string;
    coverLetter?: string;
    experience?: string;
    references?: string[];
    availableHours?: number;
    preferredRole?: string;
    metadata?: Record<string, unknown>;
}
export interface ContractorScreeningDTO {
    experience: number;
    reputation: number;
    completionRate: number;
    specializations: string[];
    certifications: string[];
    backgroundCheck: boolean;
    references: string[];
    metadata?: Record<string, unknown>;
}
export declare class ActivityJobService extends TenantService<Activity> {
    private readonly participantRepo;
    private readonly memberService;
    constructor();
    private isApplicationByUser;
    private findApplicationById;
    private getUserNameFromActivity;
    applyForJob(activityId: string, application: JobApplicationDTO): Promise<Activity>;
    reviewApplication(activityId: string, applicationId: string, status: ApplicationStatus, reviewedBy: string, feedback?: string): Promise<Activity>;
    private resolveApplicationAuditAction;
    private scoreNumericRequirement;
    private scoreListRequirement;
    screenContractor(userId: string, requirements: ContractorRequirements, screening: ContractorScreeningDTO): Promise<ContractorScreeningResult>;
    updateBountyStatus(activityId: string, status: 'claimed' | 'completed' | 'verified' | 'paid', updatedBy: string, payout?: number): Promise<Activity>;
    getContractorStats(userId: string, organizationId?: string): Promise<{
        totalApplications: number;
        acceptedApplications: number;
        rejectedApplications: number;
        pendingApplications: number;
        completedJobs: number;
        totalEarnings: number;
        averageRating: number;
        specializations: string[];
    }>;
    submitApplication(activityId: string, applicationData: {
        applicantId: string;
        applicantName: string;
        applicantEmail?: string;
        rsiHandle?: string;
        discordId?: string;
        message?: string;
        answers?: Array<{
            questionId: string;
            question: string;
            answer: string;
        }>;
        referredBy?: string;
        timezone?: string;
        availablePlaytimes?: string[];
        preferredRoles?: string[];
    }): Promise<ActivityApplication>;
    private performScreening;
    acceptApplication(activityId: string, applicationId: string, reviewerId: string, notes?: string): Promise<ActivityApplication>;
    private addAcceptedRecruitToOrganization;
    rejectApplication(activityId: string, applicationId: string, reviewerId: string, reason?: string): Promise<ActivityApplication>;
    advanceApplicationStage(activityId: string, applicationId: string, reviewerId: string, comment?: string): Promise<ActivityApplication>;
    withdrawApplication(activityId: string, applicationId: string, applicantId: string): Promise<ActivityApplication>;
    getApplications(activityId: string, filters?: {
        status?: ApplicationStatus;
        applicantId?: string;
    }): Promise<ActivityApplication[]>;
    scheduleInterview(activityId: string, applicationId: string, interviewData: {
        scheduledAt: Date;
        interviewerId: string;
        notes?: string;
    }): Promise<ActivityApplication>;
    completeJob(activityId: string, applicationId: string, completionData: {
        rating?: number;
        review?: string;
    }): Promise<ActivityApplication>;
}
//# sourceMappingURL=ActivityJobService.d.ts.map