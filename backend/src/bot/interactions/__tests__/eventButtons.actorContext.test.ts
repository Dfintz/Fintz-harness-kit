const mockResolveInternalUserId = jest.fn();
const mockResolveGuestContext = jest.fn();

jest.mock('../eventButtons.identity', () => ({
  resolveInternalUserId: (...args: unknown[]) => mockResolveInternalUserId(...args),
}));

jest.mock('../eventButtons.guestContext', () => ({
  resolveGuestContext: (...args: unknown[]) => mockResolveGuestContext(...args),
}));

import { resolveActionActorContext } from '../eventButtons.actorContext';

describe('eventButtons.actorContext seam', () => {
  const interaction = {
    user: { id: 'discord-user-1', username: 'Pilot' },
    reply: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns internal user context for linked users', async () => {
    mockResolveInternalUserId.mockResolvedValueOnce('internal-1');

    const result = await resolveActionActorContext(interaction as never);

    expect(result).toEqual({
      userId: 'internal-1',
      isDiscordGuest: false,
      guestContext: null,
    });
    expect(mockResolveGuestContext).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('returns guest context when account is unlinked but guest fallback is allowed', async () => {
    mockResolveInternalUserId.mockResolvedValueOnce(null);
    mockResolveGuestContext.mockResolvedValueOnce({
      guestId: 'guest-uuid',
      guestMemberRoleIds: ['role-1'],
      advancedEventSettings: { allowDiscordGuests: true },
    });

    const result = await resolveActionActorContext(interaction as never);

    expect(result).toEqual({
      userId: 'guest-uuid',
      isDiscordGuest: true,
      guestContext: {
        guestId: 'guest-uuid',
        guestMemberRoleIds: ['role-1'],
        advancedEventSettings: { allowDiscordGuests: true },
      },
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('replies with fallback message and returns null when no actor context is resolvable', async () => {
    mockResolveInternalUserId.mockResolvedValueOnce(null);
    mockResolveGuestContext.mockResolvedValueOnce(null);

    const result = await resolveActionActorContext(interaction as never);

    expect(result).toBeNull();
    expect(interaction.reply).toHaveBeenCalledWith({
      content: '❌ Please link your Discord account on the web app first, then try again.',
      flags: expect.any(Number),
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
