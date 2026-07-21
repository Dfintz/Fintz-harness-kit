jest.mock('../../../services/social', () => ({
  SocialGroupService: {
    getInstance: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('../../../services/social/ReputationService', () => ({
  ReputationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../../services/shared/RedisRateLimiter', () => ({
  redisRateLimiter: { check: jest.fn().mockResolvedValue({ allowed: true }) },
}));

jest.mock('../../../websocket/controllers/lfgWebSocketController', () => ({
  emitLfgMemberJoined: jest.fn(),
  emitLfgMemberLeft: jest.fn(),
  emitLfgSessionCancelled: jest.fn(),
}));

jest.mock('../../../utils/auditLogger', () => ({
  AuditEventType: { ACTIVITY_ACTION: 'ACTIVITY_ACTION' },
  logAuditEvent: jest.fn(),
}));

jest.mock('../../commands/lfg', () => ({
  JOIN_LIMIT_PER_HOUR: 5,
  lfgJoinRateLimitKey: () => 'lfg:join:test',
}));

jest.mock('../../embeds/lfgEmbed', () => ({
  parseLfgButtonId: () => null,
  parseLfgRatingId: () => null,
  buildLfgButtons: jest.fn(() => ({ __row: 'lfg-buttons' })),
  buildLfgEmbed: jest.fn(() => ({ __embed: 'lfg-embed' })),
  buildLfgRatingDetailButton: jest.fn(),
  buildLfgRatingStarButtons: jest.fn(),
  buildTeamSuggestionButtons: jest.fn(),
  buildTeamSuggestionEmbed: jest.fn(),
  STAR_LABELS: {},
  THUMB_LABELS: {},
}));

import { parseLfgCommentModalCustomId, parseLfgTeamSuggestionCustomId } from '../lfgButtons';

describe('lfg customId parser helpers (C9)', () => {
  it('parses comment modal ids', () => {
    expect(parseLfgCommentModalCustomId('lfg_rate_comment_modal_session-1_user-1')).toEqual({
      sessionId: 'session-1',
      targetUserId: 'user-1',
    });
  });

  it('parses team suggestion actions', () => {
    expect(parseLfgTeamSuggestionCustomId('lfg_team_dismiss_guild-1')).toEqual({
      action: 'dismiss',
      guildId: 'guild-1',
    });
    expect(parseLfgTeamSuggestionCustomId('lfg_team_later_guild-1')).toEqual({
      action: 'later',
      guildId: 'guild-1',
    });
    expect(parseLfgTeamSuggestionCustomId('lfg_team_create_guild-1_u1-u2-u3')).toEqual({
      action: 'create',
      guildId: 'guild-1',
      memberIds: ['u1', 'u2', 'u3'],
    });
  });

  it('keeps permissive parsing for extra params', () => {
    expect(parseLfgCommentModalCustomId('lfg_rate_comment_modal_session-1_user-1_extra')).toEqual({
      sessionId: 'session-1',
      targetUserId: 'user-1',
    });
    expect(parseLfgTeamSuggestionCustomId('lfg_team_dismiss_guild-1_extra')).toEqual({
      action: 'dismiss',
      guildId: 'guild-1',
    });
  });

  it.each([
    'lfg_rate_comment_modal_session-1',
    'lfg_rate_thumb_up_session-1_user-1',
    'lfg_team_create_guild-1',
    'lfg_team_unknown_guild-1',
  ])('returns null for unmatched id: %s', customId => {
    expect(parseLfgCommentModalCustomId(customId)).toBeNull();
    expect(parseLfgTeamSuggestionCustomId(customId)).toBeNull();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
