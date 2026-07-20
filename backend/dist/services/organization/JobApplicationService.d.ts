import { type ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { JobApplication, JobApplicationStatus, JobApplicationType } from '../../models/JobApplication';
export declare const TERMINAL_STATUSES: JobApplicationStatus[];
export declare const NON_TERMINAL_STATUSES: JobApplicationStatus[];
export interface ApplyToJobInput {
    jobListingId: string;
    applicantUserId: string;
    applicantDisplayName: string;
    applicationType: JobApplicationType;
    message?: string;
    shipIndex?: number;
    roleIndex?: number;
    passengerShipIndex?: number;
    passengerRole?: string;
    vehicleName?: string;
    formResponses?: Record<string, string>;
}
export interface ReviewApplicationInput {
    status: JobApplicationStatus.APPROVED | JobApplicationStatus.REJECTED | JobApplicationStatus.WAITLISTED;
    reviewedBy: string;
    reviewNote?: string;
    jobListingId?: string;
}
export declare class JobApplicationService {
    private readonly applicationRepository;
    private readonly jobRepository;
    constructor();
    apply(input: ApplyToJobInput): Promise<JobApplication>;
    reviewApplication(applicationId: string, input: ReviewApplicationInput): Promise<JobApplication>;
    withdrawApplication(applicationId: string, userId: string): Promise<JobApplication>;
    getApplicationsForJob(jobListingId: string, status?: JobApplicationStatus): Promise<JobApplication[]>;
    getApplicationsByUser(userId: string): Promise<JobApplication[]>;
    hasUserApplied(userId: string, jobListingId: string): Promise<JobApplication | null>;
    getWaitlist(jobListingId: string): Promise<JobApplication[]>;
    static toParticipantInfo(application: JobApplication): ParticipantInfo;
    toParticipantInfo(application: JobApplication): ParticipantInfo;
    private populateCrewFields;
    private populatePassengerFields;
    private isListingFull;
    private getNextWaitlistPosition;
    private fillSlot;
    private fillCrewSlot;
    private fillPassengerSlot;
}
//# sourceMappingURL=JobApplicationService.d.ts.map