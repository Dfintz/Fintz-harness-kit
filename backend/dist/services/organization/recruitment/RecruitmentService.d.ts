import { Activity, ActivityApplication, ActivityVisibility, ApplicationStatus } from '../../../models/Activity';
import { PaginatedResponse } from '../../../utils/pagination';
import { TenantService } from '../../base/TenantService';
export interface SkillMatchCriteria {
    requiredSkills: string[];
    preferredSkills?: string[];
    minimumExperience?: number;
    requiredRoles?: string[];
    timezone?: string;
    languages?: string[];
}
export interface CandidateProfile {
    userId: string;
    skills: string[];
    experience: number;
    preferredRoles: string[];
    timezone?: string;
    languages?: string[];
    availability?: string[];
    reputation?: number;
}
export interface SkillMatchResult {
    candidateId: string;
    score: number;
    matchedSkills: string[];
    missingRequiredSkills: string[];
    matchedPreferredSkills: string[];
    experienceMatch: boolean;
    timezoneMatch: boolean;
    recommendation: 'strong' | 'moderate' | 'weak' | 'not_recommended';
}
export interface OnboardingStep {
    id: string;
    name: string;
    description: string;
    order: number;
    isRequired: boolean;
    completedBy?: string;
    completedAt?: Date;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}
export interface OnboardingWorkflow {
    recruitmentId: string;
    candidateId: string;
    startedAt: Date;
    completedAt?: Date;
    steps: OnboardingStep[];
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    mentor?: {
        userId: string;
        userName: string;
        assignedAt: Date;
    };
}
export interface RecruitmentAnalytics {
    totalRecruitments: number;
    activeRecruitments: number;
    closedRecruitments: number;
    totalApplications: number;
    acceptedApplications: number;
    rejectedApplications: number;
    pendingApplications: number;
    averageTimeToFill: number;
    applicationToAcceptanceRate: number;
    topSkillsNeeded: Array<{
        skill: string;
        count: number;
    }>;
    applicationsByRole: Record<string, number>;
    recruitmentsByMonth: Array<{
        month: string;
        count: number;
    }>;
    conversionFunnel: {
        applied: number;
        reviewed: number;
        interviewed: number;
        accepted: number;
    };
}
export interface RecruitmentFilterOptions {
    status?: 'open' | 'closed' | 'paused';
    organizationId?: string;
    searchTerm?: string;
    skills?: string[];
    roles?: string[];
    hasOpenSlots?: boolean;
    page?: number;
    limit?: number;
}
export interface RecruitmentPendingApplicant {
    applicationId: string;
    applicantId: string;
    applicantName?: string;
    rsiHandle?: string;
    status: ApplicationStatus;
    appliedAt: Date;
    recruitmentId: string;
    recruitmentTitle: string;
}
export declare class RecruitmentService extends TenantService<Activity> {
    private static instance;
    private onboardingWorkflows;
    constructor();
    static getInstance(): RecruitmentService;
    createRecruitment(organizationId: string, data: {
        title: string;
        description: string;
        creatorId: string;
        creatorName: string;
        organizationName?: string;
        rolesNeeded: string[];
        requirements?: string;
        maxPositions?: number;
        skillMatchCriteria?: SkillMatchCriteria;
        visibility?: ActivityVisibility;
        expiresAt?: Date;
        tags?: string[];
    }): Promise<Activity>;
    getRecruitments(organizationId: string, filters: RecruitmentFilterOptions): Promise<PaginatedResponse<Activity>>;
    calculateSkillMatch(candidate: CandidateProfile, criteria: SkillMatchCriteria): SkillMatchResult;
    findMatchingCandidates(recruitmentId: string, candidates: CandidateProfile[], minScore?: number): Promise<SkillMatchResult[]>;
    createOnboardingWorkflow(recruitmentId: string, candidateId: string, customSteps?: Partial<OnboardingStep>[]): Promise<OnboardingWorkflow>;
    getOnboardingWorkflow(recruitmentId: string, candidateId: string): Promise<OnboardingWorkflow | null>;
    completeOnboardingStep(recruitmentId: string, candidateId: string, stepId: string, completedBy: string): Promise<OnboardingWorkflow | null>;
    assignMentor(recruitmentId: string, candidateId: string, mentorId: string, mentorName: string): Promise<OnboardingWorkflow | null>;
    getRecruitmentAnalytics(organizationId: string): Promise<RecruitmentAnalytics>;
    private groupByMonth;
    evaluateApplication(recruitmentId: string, applicationId: string, candidateProfile: CandidateProfile): Promise<{
        application: ActivityApplication;
        matchResult: SkillMatchResult;
        autoApproved: boolean;
    }>;
    getApplicationStats(recruitmentId: string): Promise<{
        total: number;
        byStatus: Record<ApplicationStatus, number>;
        averageScore: number;
        topCandidates: Array<{
            applicantId: string;
            applicantName: string;
            score: number;
        }>;
    }>;
    getPendingApplicantsForOrg(organizationId: string): Promise<RecruitmentPendingApplicant[]>;
    getRecruitmentDashboard(organizationId: string): Promise<RecruitmentDashboard>;
    getCandidatePipeline(organizationId: string, recruitmentId?: string): Promise<CandidatePipeline>;
    getPipelineHistory(organizationId: string, days?: number): Promise<PipelineHistory>;
    private countApplicationsInPeriod;
    private countAcceptedInPeriod;
    private countPendingReview;
    private calculateAverageTimeToFirstReview;
    private calculateAverageTimeToHire;
    private calculatePerformanceBySource;
    private calculateAcceptanceRateTrend;
    private countOldPendingApplications;
    private countExpiringRecruitments;
    private generateRecruitmentInsights;
    private mapStatusToStage;
    private calculateDaysInStage;
    private identifyBottleneck;
    private calculateStageVelocity;
}
export interface SourcePerformance {
    applications: number;
    acceptanceRate: number;
    avgScore: number;
}
export interface RecruitmentInsight {
    type: 'positive' | 'warning' | 'info';
    category: 'applications' | 'efficiency' | 'quality' | 'visibility';
    message: string;
    actionable: string;
}
export interface RecruitmentDashboard {
    summary: {
        totalRecruitments: number;
        activeRecruitments: number;
        totalApplications: number;
        recentApplications: number;
        acceptedThisMonth: number;
        pendingReview: number;
    };
    trends: {
        applicationTrend: number;
        recruitmentTrend: number;
        acceptanceRateTrend: number;
    };
    efficiency: {
        avgTimeToFirstReview: number;
        avgTimeToHire: number;
        avgApplicationsPerPosition: number;
        fillRate: number;
    };
    performanceBySource: Record<string, SourcePerformance>;
    applicationsByDay: Array<{
        date: string;
        count: number;
    }>;
    urgentItems: {
        recruitmentWithNoApplicants: number;
        applicationsPendingOver7Days: number;
        expiringRecruitments: number;
    };
    insights: RecruitmentInsight[];
    lastUpdated: Date;
}
export interface PipelineCandidate {
    id: string;
    applicantId: string;
    applicantName: string;
    recruitmentId: string;
    recruitmentTitle: string;
    currentStage: string;
    appliedAt: Date;
    lastUpdated: Date;
    score?: number;
    daysInCurrentStage: number;
}
export interface PipelineStage {
    id: string;
    name: string;
    order: number;
    color: string;
    candidates: PipelineCandidate[];
    metrics: {
        count: number;
        avgDaysInStage: number;
        conversionRate: number;
    };
}
export interface StageTransition {
    fromStage: string;
    toStage: string;
    count: number;
    conversionRate: number;
}
export interface CandidatePipeline {
    stages: PipelineStage[];
    transitions: StageTransition[];
    summary: {
        totalCandidates: number;
        overallConversionRate: number;
        avgTimeToHire: number;
        bottleneckStage: string | null;
    };
    recruitmentId?: string;
    organizationId: string;
    generatedAt: Date;
}
export interface PipelineHistory {
    organizationId: string;
    periodDays: number;
    dailySnapshots: Array<{
        date: string;
        stages: Record<string, number>;
    }>;
    stageVelocity: Record<string, number>;
    generatedAt: Date;
}
//# sourceMappingURL=RecruitmentService.d.ts.map