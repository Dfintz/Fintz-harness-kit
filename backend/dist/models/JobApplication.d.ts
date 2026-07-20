import { PublicJobListing } from './PublicJobListing';
import { User } from './User';
export declare enum JobApplicationStatus {
    PENDING = "pending",
    APPROVED = "approved",
    REJECTED = "rejected",
    WAITLISTED = "waitlisted",
    WITHDRAWN = "withdrawn"
}
export declare enum JobApplicationType {
    CREW = "crew",
    PASSENGER = "passenger",
    VEHICLE = "vehicle",
    GENERAL = "general"
}
export declare class JobApplication {
    id: string;
    jobListingId: string;
    jobListing?: PublicJobListing;
    applicantUserId: string;
    applicant?: User;
    applicationType: JobApplicationType;
    status: JobApplicationStatus;
    applicantDisplayName: string;
    message?: string;
    shipIndex?: number;
    roleIndex?: number;
    roleName?: string;
    shipName?: string;
    passengerShipIndex?: number;
    passengerRole?: string;
    vehicleName?: string;
    formResponses?: Record<string, string>;
    reviewedBy?: string;
    reviewNote?: string;
    reviewedAt?: Date;
    waitlistPosition?: number;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=JobApplication.d.ts.map