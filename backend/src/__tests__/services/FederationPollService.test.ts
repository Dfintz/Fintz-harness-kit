jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/federation/FederationAmbassadorService');

import { AppDataSource } from '../../data-source';
import { FederationAmbassadorService } from '../../services/federation/FederationAmbassadorService';
import { FederationPollService } from '../../services/federation/FederationPollService';

describe('FederationPollService', () => {
  let service: FederationPollService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPollRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockVoteRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockMemberRepo: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockAmbassadorService: any;

  const FEDERATION_ID = 'fed-111';
  const USER_ID = 'user-abc';

  beforeEach(() => {
    jest.clearAllMocks();

    mockPollRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    mockVoteRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    };

    mockMemberRepo = {
      findOne: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      const name = entity?.name ?? '';
      if (name === 'Poll') return mockPollRepo;
      if (name === 'PollVote') return mockVoteRepo;
      if (name === 'FederationMember') return mockMemberRepo;
      return {};
    });

    mockAmbassadorService = {
      hasPermission: jest.fn(),
      findByUser: jest.fn(),
    };
    (FederationAmbassadorService.getInstance as jest.Mock).mockReturnValue(mockAmbassadorService);

    service = new FederationPollService();
  });

  describe('createPoll', () => {
    it('should create a poll with options', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const saved = {
        id: 'poll-1',
        federationId: FEDERATION_ID,
        title: 'Fleet Day?',
        description: null,
        pollType: 'single_choice',
        options: [
          { id: 'opt-1', label: 'Saturday', sortOrder: 0 },
          { id: 'opt-2', label: 'Sunday', sortOrder: 1 },
        ],
        votingMode: 'equal',
        isAnonymous: false,
        maxSelections: 1,
        status: 'active',
        createdBy: USER_ID,
        createdByName: null,
        endsAt: null,
        closedAt: null,
        votes: [],
        createdAt: new Date(),
      };
      mockPollRepo.create.mockReturnValue(saved);
      mockPollRepo.save.mockResolvedValue(saved);

      const result = await service.createPoll(FEDERATION_ID, USER_ID, {
        title: 'Fleet Day?',
        options: [{ label: 'Saturday' }, { label: 'Sunday' }],
      });

      expect(result.id).toBe('poll-1');
      expect(result.title).toBe('Fleet Day?');
      expect(mockPollRepo.save).toHaveBeenCalled();
    });

    it('should reject if fewer than 2 options', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      await expect(
        service.createPoll(FEDERATION_ID, USER_ID, {
          title: 'Bad Poll',
          options: [{ label: 'Only one' }],
        })
      ).rejects.toThrow('At least 2 options');
    });

    it('should reject if lacking vote permission', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(false);

      await expect(
        service.createPoll(FEDERATION_ID, USER_ID, {
          title: 'Test',
          options: [{ label: 'A' }, { label: 'B' }],
        })
      ).rejects.toThrow('permission required');
    });
  });

  describe('castVote', () => {
    it('should cast a vote successfully', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);
      mockAmbassadorService.findByUser.mockResolvedValue(null);

      const poll = {
        id: 'poll-1',
        federationId: FEDERATION_ID,
        status: 'active',
        options: [
          { id: 'opt-1', label: 'A', sortOrder: 0 },
          { id: 'opt-2', label: 'B', sortOrder: 1 },
        ],
        votingMode: 'equal',
        endsAt: null,
        votes: [],
      };
      mockPollRepo.findOne.mockResolvedValue(poll);
      mockVoteRepo.findOne.mockResolvedValue(null); // no existing vote
      mockVoteRepo.create.mockReturnValue({});
      mockVoteRepo.save.mockResolvedValue({});

      const result = await service.castVote(FEDERATION_ID, USER_ID, 'poll-1', 'opt-1');

      expect(result.pollId).toBe('poll-1');
      expect(mockVoteRepo.save).toHaveBeenCalled();
    });

    it('should reject duplicate vote', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockPollRepo.findOne.mockResolvedValue({
        id: 'poll-1',
        federationId: FEDERATION_ID,
        status: 'active',
        options: [{ id: 'opt-1', label: 'A', sortOrder: 0 }],
        votingMode: 'equal',
        endsAt: null,
        votes: [],
      });
      mockVoteRepo.findOne.mockResolvedValue({ id: 'existing-vote' });

      await expect(service.castVote(FEDERATION_ID, USER_ID, 'poll-1', 'opt-1')).rejects.toThrow(
        'already voted'
      );
    });

    it('should reject vote on closed poll', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      mockPollRepo.findOne.mockResolvedValue({
        id: 'poll-1',
        federationId: FEDERATION_ID,
        status: 'closed',
        options: [{ id: 'opt-1', label: 'A', sortOrder: 0 }],
        votes: [],
      });

      await expect(service.castVote(FEDERATION_ID, USER_ID, 'poll-1', 'opt-1')).rejects.toThrow(
        'no longer active'
      );
    });
  });

  describe('closePoll', () => {
    it('should close an active poll', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const poll = {
        id: 'poll-1',
        federationId: FEDERATION_ID,
        status: 'active',
        votes: [],
      };
      mockPollRepo.findOne.mockResolvedValue({ ...poll });
      mockPollRepo.save.mockImplementation(async (entity: Record<string, unknown>) => entity);

      const result = await service.closePoll(FEDERATION_ID, USER_ID, 'poll-1');

      expect(result.status).toBe('closed');
    });
  });

  describe('deletePoll', () => {
    it('should delete a poll and its votes', async () => {
      mockAmbassadorService.hasPermission.mockResolvedValue(true);

      const poll = { id: 'poll-1', federationId: FEDERATION_ID };
      mockPollRepo.findOne.mockResolvedValue(poll);

      await service.deletePoll(FEDERATION_ID, USER_ID, 'poll-1');

      expect(mockVoteRepo.delete).toHaveBeenCalledWith({ pollId: 'poll-1' });
      expect(mockPollRepo.remove).toHaveBeenCalledWith(poll);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
