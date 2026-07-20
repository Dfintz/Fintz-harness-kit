import { Activity } from '../../models/Activity';
import { AttendanceStatus, EventAttendanceConfirmation } from '../../models/EventAttendanceConfirmation';
import { TenantService } from '../base/TenantService';
import { NotificationService } from '../communication';
export interface AttendanceRecord {
    userId: string;
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
export declare class ActivityAttendanceService extends TenantService<EventAttendanceConfirmation> {
    private readonly activityRepository;
    private readonly participantRepo;
    private readonly notificationService;
    constructor(notificationService: NotificationService);
    initializeActivityAttendance(activityId: string): Promise<EventAttendanceConfirmation[]>;
    recordAttendance(organizationId: string, activityId: string, record: AttendanceRecord): Promise<EventAttendanceConfirmation>;
    confirmAttendance(activityId: string, userId: string, actualRole?: string, confirmedBy?: string): Promise<EventAttendanceConfirmation>;
    markNoShow(activityId: string, userId: string, excused?: boolean, reason?: string, markedBy?: string): Promise<EventAttendanceConfirmation>;
    sendConfirmationRequests(activityId: string): Promise<number>;
    private sendConfirmationRequest;
    autoConfirmNoShows(daysOld?: number): Promise<number>;
    getActivityAttendanceStats(activityId: string): Promise<AttendanceStats>;
    getAttendedEventCount(organizationId: string, userId: string): Promise<number>;
    getUserAttendanceHistory(userId: string, monthsBack?: number, organizationId?: string): Promise<UserAttendanceHistory>;
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
export { AttendanceStatus, EventAttendanceConfirmation };
//# sourceMappingURL=ActivityAttendanceService.d.ts.map