/**
 * PollService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - missing poll (delete / castVote / toggleVote)  → NotFoundError (statusCode 404)
 * - acting on a non-active / closed poll            → ConflictError (statusCode 409)
 * - invalid option / selection-count violations     → ValidationError (statusCode 400)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response. The ConflictError (409) and ValidationError (400)
 * paths previously threw a bare Error that fell through to 500, so these guard
 * the 500→409 / 500→400 fixes.
 */
import { Poll, PollStatus, PollType } from '../../../models/Poll';
import { PollVote } from '../../../models/PollVote';
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/apiErrors';

const mockPollRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
  // TenantService base reads repository.metadata.name in its constructor
  metadata: { name: 'Poll', primaryColumns: [{ propertyName: 'id' }] },
};

const mockVoteRepo = {
  count: jest.fn(),
  delete: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Poll) return mockPollRepo;
      if (entity === PollVote) return mockVoteRepo;
      return {};
    }),
  },
}));

jest.mock('../../../services/poll/DiscordPollService', () => ({
  DiscordPollService: jest.fn().mockImplementation(() => ({
    closeAllMirrors: jest.fn(),
    postPollToDiscord: jest.fn(),
  })),
}));

jest.mock('../../../websocket/websocketServer', () => ({ emitToOrganization: jest.fn() }));
jest.mock('../../../utils/auditLogger', () => ({ logAuditEvent: jest.fn(), AuditEventType: {} }));

// Import after mocks
import { PollService } from '../../../services/poll/PollService';
import { emitToOrganization } from '../../../websocket/websocketServer';

const mockEmitToOrganization = emitToOrganization as jest.Mock;

describe('PollService — typed error contract', () => {
  let service: PollService;

  const orgId = 'org-1';
  const userId = 'user-1';
  const userName = 'Tester';
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
    service = new PollService();
    mockVoteRepo.count.mockResolvedValue(0);
    mockVoteRepo.delete.mockResolvedValue({ affected: 0 });
  });

  // ─── updatePoll ────────────────────────────────────────────────────────
  describe('updatePoll', () => {
    it('throws ConflictError (409) when the poll is closed or cancelled', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll({ status: PollStatus.CLOSED }));

      const error = await service
        .updatePoll(orgId, pollId, userId, userName, { title: 'x' })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ConflictError (409) when changing options after votes exist', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll());
      mockVoteRepo.count.mockResolvedValue(3);

      const error = await service
        .updatePoll(orgId, pollId, userId, userName, {
          options: [{ id: 'opt-1', label: 'A', sortOrder: 0 }],
        })
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });

  // ─── deletePoll ────────────────────────────────────────────────────────
  describe('deletePoll', () => {
    it('throws NotFoundError (404) when the poll does not exist', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      const error = await service
        .deletePoll(orgId, pollId, userId, userName)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

  // ─── castVote ──────────────────────────────────────────────────────────
  describe('castVote', () => {
    it('throws NotFoundError (404) when the poll does not exist', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      const error = await service
        .castVote(orgId, pollId, userId, [{ optionId: 'opt-1' }])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ConflictError (409) when the poll is not active', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll({ status: PollStatus.CLOSED }));

      const error = await service
        .castVote(orgId, pollId, userId, [{ optionId: 'opt-1' }])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ValidationError (400) for an unknown option', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll());

      const error = await service
        .castVote(orgId, pollId, userId, [{ optionId: 'does-not-exist' }])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('throws ValidationError (400) when more than maxSelections are submitted', async () => {
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue(buildPoll({ pollType: PollType.MULTIPLE_CHOICE, maxSelections: 1 }));

      const error = await service
        .castVote(orgId, pollId, userId, [{ optionId: 'opt-1' }, { optionId: 'opt-2' }])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('throws ValidationError (400) for multiple selections on a single-choice poll', async () => {
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue(buildPoll({ pollType: PollType.SINGLE_CHOICE, maxSelections: 5 }));

      const error = await service
        .castVote(orgId, pollId, userId, [{ optionId: 'opt-1' }, { optionId: 'opt-2' }])
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });
  });

  // ─── toggleVote ──────────────────────────────────────────────────────────
  describe('toggleVote', () => {
    it('throws NotFoundError (404) when the poll does not exist', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      const error = await service
        .toggleVote(orgId, pollId, userId, 'opt-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });

    it('throws ConflictError (409) when the poll is not active', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll({ status: PollStatus.CLOSED }));

      const error = await service
        .toggleVote(orgId, pollId, userId, 'opt-1')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('throws ValidationError (400) for an unknown option', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll());

      const error = await service
        .toggleVote(orgId, pollId, userId, 'does-not-exist')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('throws ValidationError (400) when selecting beyond maxSelections', async () => {
      jest
        .spyOn(service, 'findById')
        .mockResolvedValue(buildPoll({ pollType: PollType.MULTIPLE_CHOICE, maxSelections: 1 }));
      mockVoteRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ optionId: 'opt-1' }]),
      });

      const error = await service
        .toggleVote(orgId, pollId, userId, 'opt-2')
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });
  });

  // ─── closePoll ───────────────────────────────────────────────────────────
  describe('closePoll', () => {
    it('throws ConflictError (409) when the poll is not active', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(buildPoll({ status: PollStatus.CLOSED }));

      const error = await service
        .closePoll(orgId, pollId, userId, userName)
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });
  });
  // ─── closeExpiredPolls (B3 / JOB-02 atomic conditional close) ───────────────
  // F5: the scheduler batch-close path transitions each expired poll with a
  // conditional `UPDATE ... WHERE status = ACTIVE` and only acts on rows it
  // actually flipped (`affected > 0`). A concurrent worker that already closed
  // the poll yields `affected === 0`, which must be a benign idempotent skip:
  // no reload, no duplicate `poll:closed` emit, and not counted.
  describe('closeExpiredPolls', () => {
    const buildExpiredPoll = (id: string): Poll =>
      ({
        id,
        organizationId: orgId,
        title: `Expired ${id}`,
        pollType: PollType.SINGLE_CHOICE,
        status: PollStatus.ACTIVE,
        endsAt: new Date(Date.now() - 60_000),
      }) as Poll;

    /** Wire createQueryBuilder to serve the SELECT (getMany) + one UPDATE (execute) per poll. */
    const setupQueryBuilder = (
      expiredPolls: Poll[],
      executeResults: Array<{ affected: number }>
    ): void => {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(expiredPolls),
        execute: jest.fn(),
      };
      for (const r of executeResults) {
        qb.execute.mockResolvedValueOnce(r);
      }
      mockPollRepo.createQueryBuilder.mockReturnValue(qb);
    };

    beforeEach(() => {
      // getResults runs fire-and-forget for the Discord mirror close; stub it so the
      // batch logic under test stays isolated from vote aggregation.
      jest.spyOn(service, 'getResults').mockResolvedValue({
        pollId: 'x',
        totalVotes: 0,
        optionCounts: {},
        options: [],
        hasVoted: false,
      });
    });

    it('closes each expired poll it wins the race for and counts only affected rows', async () => {
      setupQueryBuilder(
        [buildExpiredPoll('p1'), buildExpiredPoll('p2')],
        [{ affected: 1 }, { affected: 1 }]
      );
      mockPollRepo.findOne.mockResolvedValue({
        ...buildExpiredPoll('p1'),
        status: PollStatus.CLOSED,
        closedAt: new Date(),
      });

      const count = await service.closeExpiredPolls();

      expect(count).toBe(2);
      expect(mockEmitToOrganization).toHaveBeenCalledTimes(2);
      expect(mockEmitToOrganization).toHaveBeenCalledWith(
        orgId,
        'poll:closed',
        expect.objectContaining({ reason: 'expired' })
      );
    });

    it('treats affected===0 as a benign skip (already closed by another worker)', async () => {
      setupQueryBuilder([buildExpiredPoll('p1')], [{ affected: 0 }]);

      const count = await service.closeExpiredPolls();

      expect(count).toBe(0);
      // No reload and no duplicate close emit when another worker already won.
      expect(mockPollRepo.findOne).not.toHaveBeenCalled();
      expect(mockEmitToOrganization).not.toHaveBeenCalled();
    });

    it('counts only the winners in a mixed batch where one poll was already closed', async () => {
      setupQueryBuilder(
        [buildExpiredPoll('p1'), buildExpiredPoll('p2'), buildExpiredPoll('p3')],
        [{ affected: 1 }, { affected: 0 }, { affected: 1 }]
      );
      mockPollRepo.findOne.mockResolvedValue({
        ...buildExpiredPoll('p1'),
        status: PollStatus.CLOSED,
        closedAt: new Date(),
      });

      const count = await service.closeExpiredPolls();

      // p1 + p3 won; p2 was already closed and skipped.
      expect(count).toBe(2);
      expect(mockEmitToOrganization).toHaveBeenCalledTimes(2);
    });

    it('does not count or notify when the closed poll cannot be reloaded', async () => {
      setupQueryBuilder([buildExpiredPoll('p1')], [{ affected: 1 }]);
      mockPollRepo.findOne.mockResolvedValue(null);

      const count = await service.closeExpiredPolls();

      expect(count).toBe(0);
      expect(mockEmitToOrganization).not.toHaveBeenCalled();
    });

    it('returns 0 and performs no updates when there are no expired polls', async () => {
      setupQueryBuilder([], []);

      const count = await service.closeExpiredPolls();

      expect(count).toBe(0);
      expect(mockPollRepo.findOne).not.toHaveBeenCalled();
      expect(mockEmitToOrganization).not.toHaveBeenCalled();
    });
  });
});
