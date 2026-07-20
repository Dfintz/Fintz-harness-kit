export interface ActivityData {
    id: string;
    name?: string;
    description?: string;
    activityType?: string;
    status?: string;
    startDate?: Date | string;
    endDate?: Date | string;
    participants?: unknown[];
    [key: string]: unknown;
}
export interface ActivityParticipant {
    userId: string;
    userName: string;
    role?: string;
    status?: string;
    [key: string]: unknown;
}
export interface ActivityEvent {
    type: 'activity:created' | 'activity:updated' | 'activity:deleted' | 'activity:participant_joined' | 'activity:participant_left' | 'activity:status_changed' | 'activity:reminder' | 'activity:ready_check_initiated' | 'activity:ready_check_response' | 'activity:ready_check_completed' | 'activity:ready_check_expired' | 'activity:ready_check_cancelled';
    organizationId: string;
    activityId: string;
    data: ActivityData | Record<string, unknown>;
    timestamp: number;
    userId?: string;
}
export declare const emitActivityCreated: (organizationId: string | null, activity: ActivityData | Record<string, unknown>, userId?: string) => void;
export declare const emitActivityUpdated: (organizationId: string | null, activity: ActivityData | Record<string, unknown>, userId?: string) => void;
export declare const emitActivityDeleted: (organizationId: string | null, activityId: string, userId?: string) => void;
export declare const emitParticipantJoined: (organizationId: string, activityId: string, participant: ActivityParticipant, userId?: string) => void;
export declare const emitParticipantLeft: (organizationId: string, activityId: string, participantId: string, userId?: string) => void;
export declare const emitActivityStatusChanged: (organizationId: string, activityId: string, oldStatus: string, newStatus: string, userId?: string) => void;
export declare const emitActivityReminder: (organizationId: string, activityId: string, activity: ActivityData | Record<string, unknown>, reminderMinutes: number) => void;
export declare const emitReadyCheckInitiated: (organizationId: string, activityId: string, readyCheck: Record<string, unknown>, userId?: string) => void;
export declare const emitReadyCheckResponse: (organizationId: string, activityId: string, readyCheckSummary: Record<string, unknown>, userId?: string) => void;
export declare const emitReadyCheckCompleted: (organizationId: string, activityId: string, readyCheckSummary: Record<string, unknown>, userId?: string) => void;
export declare const emitReadyCheckExpired: (organizationId: string, activityId: string, readyCheckSummary: Record<string, unknown>) => void;
export declare const emitReadyCheckCancelled: (organizationId: string, activityId: string, userId?: string) => void;
//# sourceMappingURL=activityWebSocketController.d.ts.map