/**
 * DiscordPollService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - mirroring a non-active poll                 → ConflictError (statusCode 409)
 * - mirroring a poll already mirrored to a guild → ConflictError (statusCode 409)
 * - broadcasting to a federation with no members → ConflictError (statusCode 409)
 * - deleting a missing mirror                    → NotFoundError (statusCode 404)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response (DiscordPollService is reached via PollController,
 * which extends BaseController). All four paths previously threw a bare Error
 * that fell through to 500, so these guard the 500→409 / 500→404 fixes.
 *
 * The internal "Channel ... not found or not text-based" throw inside the private
 * deliverMirror is intentionally NOT covered here: it is caught by that method's
 * own try/catch (records mirror.status = FAILED) and never propagates to HTTP.
 */
import { FederationMember } from '../../../models/FederationMember';
import { Poll, PollStatus, PollType } from '../../../models/Poll';
import { PollDiscordMirror, PollMirrorStatus } from '../../../models/PollDiscordMirror';
import { ConflictError, NotFoundError } from '../../../utils/apiErrors';

const mockMirrorRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const mockFederationMemberRepo = {
  find: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === PollDiscordMirror) return mockMirrorRepo;
      if (entity === FederationMember) return mockFederationMemberRepo;
      return {};
    }),
  },
}));

jest.mock('../../../services/discord/GuildOrganizationService', () => ({
  GuildOrganizationService: {
    getInstance: jest.fn(() => ({ getGuildsForOrganization: jest.fn().mockResolvedValue([]) })),
  },
}));

jest.mock('../../../bot/BotClientManager', () => ({
  BotClientManager: { getInstance: jest.fn(() => ({ getClient: jest.fn(() => null) })) },
}));

jest.mock('../../../bot/embeds/pollEmbed', () => ({
  buildPollEmbed: jest.fn(() => ({})),
  buildPollButtons: jest.fn(() => []),
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Import after mocks
import { DiscordPollService } from '../../../services/poll/DiscordPollService';

describe('DiscordPollService — typed error contract', () => {
  let service: DiscordPollService;

  const orgId = 'org-1';
  const pollId = 'poll-1';

  const buildPoll = (overrides: Partial<Poll> = {}): Poll =>
    ({
      id: pollId,
      organizationId: orgId,
      title: 'Test Poll',
      pollType: PollType.SINGLE_CHOICE,
      status: PollStatus.ACTIVE,
      maxSelections: 1,
      options: [
        { id: 'opt-1', label: 'A', sortOrder: 0 },
        { id: 'opt-2', label: 'B', sortOrder: 1 },
      ],
      ...overrides,
    }) as Poll;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DiscordPollService();
  });

  // ─── mirrorPollToGuild ───────────────────────────────────────────────────
  describe('mirrorPollToGuild', () => {
    it('throws ConflictError (409) when the poll is not active', async () => {
      const error = await service
        .mirrorPollToGuild(buildPoll({ status: PollStatus.CLOSED }), orgId, {
          guildId: 'guild-1',
          channelId: 'chan-1',
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ConflictError (409) when the poll is already mirrored to the guild', async () => {
      mockMirrorRepo.findOne.mockResolvedValue({ id: 'mirror-existing' });

      const error = await service
        .mirrorPollToGuild(buildPoll(), orgId, { guildId: 'guild-1', channelId: 'chan-1' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  // ─── mirrorPollToFederation ──────────────────────────────────────────────
  describe('mirrorPollToFederation', () => {
    it('throws ConflictError (409) when the federation has no active members', async () => {
      mockFederationMemberRepo.find.mockResolvedValue([]);

      const error = await service
        .mirrorPollToFederation(buildPoll(), orgId, { federationId: 'fed-1', channelId: 'chan-1' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  // ─── deleteMirror ──────────────────────────────────────────────────────────
  describe('deleteMirror', () => {
    it('throws NotFoundError (404) when the mirror does not exist', async () => {
      mockMirrorRepo.findOne.mockResolvedValue(null);

      const error = await service.deleteMirror('mirror-1', orgId).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });
  // ─── closeAllMirrors (F5 resilience / partial-failure isolation) ──────────
  // closeAllMirrors fans out over every ACTIVE mirror and closes each under its
  // own try/catch, flipping status → CLOSED only after the embed update succeeds.
  // One mirror's failure must not abort the others, and a mirror that fails must
  // NOT be marked closed (no false-close). getClient/updateMirrorEmbed are private
  // and stubbed so the loop orchestration is exercised in isolation.
  describe('closeAllMirrors', () => {
    type PrivateMirrorApi = {
      getClient: () => unknown;
      updateMirrorEmbed: (...args: unknown[]) => Promise<void>;
    };
    const asPrivate = (svc: DiscordPollService): PrivateMirrorApi =>
      svc as unknown as PrivateMirrorApi;

    const buildMirror = (id: string): PollDiscordMirror =>
      ({
        id,
        pollId,
        organizationId: orgId,
        status: PollMirrorStatus.ACTIVE,
        messageId: `msg-${id}`,
        channelId: `chan-${id}`,
      }) as PollDiscordMirror;

    it('closes every active mirror and flips each to CLOSED on success', async () => {
      const mirrors = [buildMirror('m1'), buildMirror('m2')];
      mockMirrorRepo.find.mockResolvedValue(mirrors);
      jest.spyOn(asPrivate(service), 'getClient').mockReturnValue({});
      const updateSpy = jest
        .spyOn(asPrivate(service), 'updateMirrorEmbed')
        .mockResolvedValue(undefined);

      await service.closeAllMirrors(buildPoll({ status: PollStatus.CLOSED }), null);

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(mockMirrorRepo.save).toHaveBeenCalledTimes(2);
      expect(mirrors[0].status).toBe(PollMirrorStatus.CLOSED);
      expect(mirrors[1].status).toBe(PollMirrorStatus.CLOSED);
    });

    it('isolates a single mirror failure: others still close and the failed one stays ACTIVE', async () => {
      const mirrors = [buildMirror('m1'), buildMirror('m2'), buildMirror('m3')];
      mockMirrorRepo.find.mockResolvedValue(mirrors);
      jest.spyOn(asPrivate(service), 'getClient').mockReturnValue({});
      jest
        .spyOn(asPrivate(service), 'updateMirrorEmbed')
        .mockImplementation(async (...args: unknown[]) => {
          const mirror = args[1] as PollDiscordMirror;
          if (mirror.id === 'm2') {
            throw new Error('discord 500');
          }
        });

      await service.closeAllMirrors(buildPoll({ status: PollStatus.CLOSED }), null);

      // m1 + m3 closed and saved; m2 failed before the status flip + save.
      expect(mockMirrorRepo.save).toHaveBeenCalledTimes(2);
      expect(mirrors[0].status).toBe(PollMirrorStatus.CLOSED);
      expect(mirrors[1].status).toBe(PollMirrorStatus.ACTIVE);
      expect(mirrors[2].status).toBe(PollMirrorStatus.CLOSED);
    });

    it('is a no-op when there are no active mirrors', async () => {
      mockMirrorRepo.find.mockResolvedValue([]);
      const getClientSpy = jest.spyOn(asPrivate(service), 'getClient');

      await service.closeAllMirrors(buildPoll({ status: PollStatus.CLOSED }), null);

      // Short-circuits before even resolving the client.
      expect(getClientSpy).not.toHaveBeenCalled();
      expect(mockMirrorRepo.save).not.toHaveBeenCalled();
    });

    it('does not close mirrors when the Discord client is unavailable', async () => {
      mockMirrorRepo.find.mockResolvedValue([buildMirror('m1')]);
      jest.spyOn(asPrivate(service), 'getClient').mockReturnValue(null);

      await service.closeAllMirrors(buildPoll({ status: PollStatus.CLOSED }), null);

      expect(mockMirrorRepo.save).not.toHaveBeenCalled();
    });
  });
});
