import { Activity } from '../../models/Activity';
import { NotificationContext } from '../../services/communication/notifications/NotificationRouter';
export declare function notifyActivityJoinedHelper(input: {
    activity: Activity;
    userId: string;
    userName: string;
    notifyUser: (payload: {
        context: NotificationContext;
        userId: string;
        title: string;
        message: string;
        senderId: string;
        actionUrl: string;
        metadata: Record<string, unknown>;
    }) => Promise<unknown>;
    notifyOrg: (payload: {
        context: NotificationContext;
        organizationId: string;
        title: string;
        message: string;
        senderId: string;
        activityId: string;
    }) => void;
}): void;
export declare function validateQuickJoinActivityHelper(activity: Activity): void;
export declare function findActivityByQuickJoinTokenHelper(token: string, tokensEqualConstantTime: (left: string, right: string) => boolean): Promise<Activity | null>;
export declare function tokensEqualConstantTimeHelper(left: string, right: string): boolean;
//# sourceMappingURL=activityController.quickJoinHelpers.d.ts.map