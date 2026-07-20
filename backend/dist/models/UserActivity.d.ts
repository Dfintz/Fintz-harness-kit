import { User } from './User';
export declare class UserActivity {
    id: string;
    userId: string;
    user: User;
    action: string;
    resource?: string;
    method?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
    statusCode?: number;
    duration?: number;
    timestamp: Date;
}
export declare enum ActivityAction {
    LOGIN = "auth.login",
    LOGOUT = "auth.logout",
    LOGIN_FAILED = "auth.login_failed",
    TWO_FACTOR_ENABLED = "auth.2fa_enabled",
    TWO_FACTOR_DISABLED = "auth.2fa_disabled",
    USER_CREATED = "user.created",
    USER_UPDATED = "user.updated",
    USER_DELETED = "user.deleted",
    PASSWORD_CHANGED = "user.password_changed",
    EMAIL_CHANGED = "user.email_changed",
    ROLE_CHANGED = "user.role_changed",
    PASSWORD_RESET_REQUESTED = "auth.password_reset_requested",
    PASSWORD_RESET_COMPLETED = "auth.password_reset_completed",
    PASSWORD_RESET_FAILED = "auth.password_reset_failed",
    PROFILE_VIEWED = "profile.viewed",
    PROFILE_UPDATED = "profile.updated",
    ORG_JOINED = "org.joined",
    ORG_LEFT = "org.left",
    ORG_CREATED = "org.created",
    SECURITY_ALERT = "security.alert",
    SUSPICIOUS_ACTIVITY = "security.suspicious",
    ACCOUNT_LOCKED = "security.locked",
    ACCOUNT_UNLOCKED = "security.unlocked"
}
//# sourceMappingURL=UserActivity.d.ts.map