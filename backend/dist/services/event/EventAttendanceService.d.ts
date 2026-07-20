import { Activity } from '../../models/Activity';
import { AttendanceStatus, EventAttendanceConfirmation } from '../../models/EventAttendanceConfirmation';
import { TenantService } from '../base/TenantService';
import { NotificationService } from '../communication';
export interface AttendanceRecord {
    userId: string;
    organizationId: string;
    status: AttendanceStatus;
    actualRole?: string;
    checkInTime?: Date;
    checkOutTime?: Date;
    notes?: string;
    confirmedBy?: string;
}
export interface AttendanceStats {
    total: number;
    attended: number;
    noShow: number;
    late: number;
    earlyDeparture: number;
    pending: number;
    attendanceRate: number;
}
export interface UserAttendanceHistory {
    userId: string;
    totalEvents: number;
    attended: number;
    noShows: number;
    late: number;
    excusedAbsences: number;
    reliabilityScore: number;
    averageRating?: number;
}
export declare class AttendanceConfirmationService extends TenantService<EventAttendanceConfirmation> {
    private activityRepository;
    private notificationService;
    constructor(notificationService: NotificationService);
    initializeActivityAttendance(activityId: string): Promise<EventAttendanceConfirmation[]>;
    recordAttendance(eventId: string, record: AttendanceRecord): Promise<EventAttendanceConfirmation>;
    getAttendanceRecordsForActivity(eventId: string, organizationId: string): Promise<EventAttendanceConfirmation[]>;
    confirmAttendance(eventId: string, userId: string, organizationId: string, actualRole?: string, confirmedBy?: string): Promise<EventAttendanceConfirmation>;
    markNoShow(eventId: string, userId: string, organizationId: string, excused?: boolean, reason?: string, markedBy?: string): Promise<EventAttendanceConfirmation>;
    sendConfirmationRequests(activityId: string): Promise<number>;
    private sendConfirmationRequest;
    autoConfirmNoShows(daysOld?: number): Promise<number>;
    getActivityAttendanceStats(eventId: string): Promise<AttendanceStats>;
    getUserAttendanceHistory(userId: string, monthsBack: number | undefined, organizationId: string): Promise<UserAttendanceHistory>;
    addPerformanceRating(confirmationId: string, rating: {
        reliability?: number;
        skillLevel?: number;
        teamwork?: number;
        comments?: string;
    }, _ratedBy: string): Promise<EventAttendanceConfirmation>;
    getAttendanceLeaderboard(organizationId: string, monthsBack?: number, limit?: number): Promise<UserAttendanceHistory[]>;
    generateAttendanceReport(activityId: string): Promise<{
        activity: Activity;
        stats: AttendanceStats;
        attendees: Array<{
            userId: string;
            status: AttendanceStatus;
            rsvpRole?: string;
            actualRole?: string;
            attendanceScore: number;
        }>;
    }>;
}
//# sourceMappingURL=EventAttendanceService.d.ts.map