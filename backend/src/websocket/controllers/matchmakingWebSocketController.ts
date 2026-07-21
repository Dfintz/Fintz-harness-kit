import { MatchQuality } from '../../services/social/MatchmakingService';
import { logger } from '../../utils/logger';
import { emitToUser } from '../websocketServer';

/**
 * Matchmaking WebSocket Controller
 * 
 * Handles real-time matchmaking events:
 * - New match suggestions
 * - Session updates
 * - Match quality updates
 */

export interface MatchmakingEvent {
    type: 'matchmaking:suggestion' | 'matchmaking:updated' | 'matchmaking:session_filled';
    userId: string;
    data: Record<string, unknown>;
    timestamp: number;
}

/**
 * Send match suggestion to user
 */
export const sendMatchSuggestion = (userId: string, matches: MatchQuality[]): void => {
    const event: MatchmakingEvent = {
        type: 'matchmaking:suggestion',
        userId,
        data: {
            matches: matches.slice(0, 5), // Send top 5 matches
            totalMatches: matches.length
        },
        timestamp: Date.now()
    };

    emitToUser(userId, 'matchmaking:suggestion', event);
    logger.debug(`Sent match suggestions to user ${userId}: ${matches.length} matches`);
};

/**
 * Notify user that their recommendations were updated
 */
export const notifyMatchesUpdated = (userId: string, count: number): void => {
    const event: MatchmakingEvent = {
        type: 'matchmaking:updated',
        userId,
        data: {
            newMatchCount: count,
            message: `${count} new matches found for you!`
        },
        timestamp: Date.now()
    };

    emitToUser(userId, 'matchmaking:updated', event);
    logger.debug(`Notified user ${userId} of ${count} updated matches`);
};

/**
 * Notify users when a session they might be interested in fills up
 */
export const notifySessionFilled = (userIds: string[], sessionId: string, activityType: string): void => {
    userIds.forEach(userId => {
        const event: MatchmakingEvent = {
            type: 'matchmaking:session_filled',
            userId,
            data: {
                sessionId,
                activityType,
                message: 'A session you were interested in has filled up'
            },
            timestamp: Date.now()
        };

        emitToUser(userId, 'matchmaking:session_filled', event);
    });

    logger.debug(`Notified ${userIds.length} users about filled session ${sessionId}`);
};

/**
 * Send real-time match quality update
 */
export const sendMatchQualityUpdate = (userId: string, sessionId: string, quality: MatchQuality): void => {
    emitToUser(userId, 'matchmaking:quality_update', {
        sessionId,
        quality,
        timestamp: Date.now()
    });

    logger.debug(`Sent match quality update to user ${userId} for session ${sessionId}`);
};
