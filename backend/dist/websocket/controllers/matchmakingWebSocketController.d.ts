import { MatchQuality } from '../../services/social/MatchmakingService';
export interface MatchmakingEvent {
    type: 'matchmaking:suggestion' | 'matchmaking:updated' | 'matchmaking:session_filled';
    userId: string;
    data: Record<string, unknown>;
    timestamp: number;
}
export declare const sendMatchSuggestion: (userId: string, matches: MatchQuality[]) => void;
export declare const notifyMatchesUpdated: (userId: string, count: number) => void;
export declare const notifySessionFilled: (userIds: string[], sessionId: string, activityType: string) => void;
export declare const sendMatchQualityUpdate: (userId: string, sessionId: string, quality: MatchQuality) => void;
//# sourceMappingURL=matchmakingWebSocketController.d.ts.map