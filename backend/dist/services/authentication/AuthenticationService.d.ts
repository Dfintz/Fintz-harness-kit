import { SessionBinding } from '../../middleware/sessionBinding';
import { RefreshToken } from '../../models/RefreshToken';
import { User } from '../../models/User';
import { UserSession } from '../../models/UserSession';
export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}
export interface TokenPayload {
    id: string;
    username: string;
    role: string;
    jti: string;
    iat: number;
    exp: number;
    sessionBinding?: SessionBinding;
}
export interface SessionMetadata {
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    sessionBinding?: SessionBinding;
}
export interface SessionInfo {
    id: number;
    sessionToken: string;
    userId: number;
    lastActivity: Date;
    expiresAt: Date;
    ipAddress?: string;
    userAgent?: string;
    isActive: boolean;
}
export interface RefreshTokenInfo {
    id: string;
    familyId: string;
    createdAt: Date;
    expiresAt: Date;
    lastUsedAt?: Date;
    ipAddress?: string;
    userAgent?: string;
}
export interface AuthConfig {
    accessTokenSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiryDays: number;
    sessionAbsoluteTimeout: number;
    sessionIdleTimeout: number;
    blacklistCacheTTL: number;
    blacklistCacheCheckPeriod: number;
}
export declare class AuthenticationService {
    private readonly refreshTokenRepository;
    private readonly sessionRepository;
    private readonly blacklistRepository;
    private readonly userRepository;
    private encryptionService;
    private readonly blacklistCache;
    private readonly config;
    private static devAccessTokenSecret;
    private static devSecretWarningLogged;
    constructor();
    private getAccessTokenSecret;
    generateAccessToken(payload: {
        id: string;
        username: string;
        role: string;
    }, sessionBinding?: SessionBinding): string;
    generateTokens(user: User, metadata?: SessionMetadata): Promise<AuthTokens>;
    validateAccessToken(token: string): Promise<TokenPayload>;
    refreshTokens(refreshToken: string, metadata?: SessionMetadata): Promise<AuthTokens>;
    revokeAccessToken(token: string, reason?: string, metadata?: SessionMetadata): Promise<void>;
    isTokenBlacklisted(jti: string): Promise<boolean>;
    generateRefreshToken(userId: string, ipAddress?: string, userAgent?: string, parentToken?: RefreshToken, location?: string): Promise<{
        token: string;
        refreshTokenRecord: RefreshToken;
    }>;
    verifyRefreshToken(token: string): Promise<RefreshToken | null>;
    rotateRefreshToken(oldToken: string, ipAddress?: string, userAgent?: string, location?: string): Promise<{
        token: string;
        refreshTokenRecord: RefreshToken;
    } | null>;
    revokeTokenFamily(familyId: string): Promise<number>;
    revokeRefreshToken(token: string): Promise<boolean>;
    revokeRefreshTokenById(tokenId: string, userId: string): Promise<boolean>;
    revokeAllUserTokens(userId: string): Promise<number>;
    getUserRefreshTokens(userId: string): Promise<RefreshTokenInfo[]>;
    detectTokenReuse(token: string): Promise<boolean>;
    createSession(userId: number, sessionToken: string, discordTokens: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    }, metadata?: SessionMetadata): Promise<UserSession>;
    getSession(sessionToken: string): Promise<UserSession | null>;
    getUserSessions(userId: number): Promise<SessionInfo[]>;
    updateActivity(sessionToken: string): Promise<void>;
    updateDiscordTokens(sessionToken: string, accessToken: string, refreshToken: string, expiresIn: number): Promise<void>;
    isSessionValid(session: UserSession): boolean;
    terminateSession(sessionToken: string): Promise<void>;
    terminateSessionById(sessionId: number, userId: number): Promise<boolean>;
    terminateAllUserSessions(userId: number): Promise<number>;
    cleanupExpiredTokens(): Promise<number>;
    cleanupExpiredSessions(): Promise<number>;
    cleanupExpiredBlacklist(): Promise<number>;
    private hashToken;
    getStats(): Promise<{
        activeSessions: number;
        activeRefreshTokens: number;
        blacklistedTokens: number;
        cacheSize: number;
    }>;
}
//# sourceMappingURL=AuthenticationService.d.ts.map