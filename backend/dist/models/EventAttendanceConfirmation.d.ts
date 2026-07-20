import type { AttendanceConfirmationSummary } from '../types/models';
import { TenantEntity } from './base/TenantEntity';
export declare enum AttendanceStatus {
    ATTENDED = "attended",
    NO_SHOW = "no_show",
    LATE = "late",
    EARLY_DEPARTURE = "early_departure",
    PENDING_CONFIRMATION = "pending_confirmation"
}
export declare class EventAttendanceConfirmation extends TenantEntity {
    id: string;
    eventId: string;
    userId: string;
    status: AttendanceStatus;
    rsvpStatus?: string;
    rsvpRole?: string;
    actualRole?: string;
    checkInTime?: Date;
    checkOutTime?: Date;
    durationMinutes?: number;
    notes?: string;
    feedbackFromOrganizer?: string;
    performanceRating?: {
        reliability?: number;
        skillLevel?: number;
        teamwork?: number;
        comments?: string;
    };
    confirmedBy?: string;
    confirmedAt?: Date;
    autoConfirmed: boolean;
    excusedAbsence: boolean;
    absenceReason?: string;
    notificationSent: boolean;
    createdAt: Date;
    updatedAt: Date;
    getAttendanceScore(): number;
    needsFollowUp(): boolean;
    getSummary(): AttendanceConfirmationSummary;
}
//# sourceMappingURL=EventAttendanceConfirmation.d.ts.map