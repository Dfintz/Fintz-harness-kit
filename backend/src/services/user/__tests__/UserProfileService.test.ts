import { User } from '../../../models/User';
import { ConflictError, NotFoundError } from '../../../utils/apiErrors';
import { UserProfileService } from '../UserProfileService';

const mockRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn(),
  increment: jest.fn(),
  update: jest.fn(),
};

const createMockUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  username: 'user-1',
  email: 'user-1@example.com',
  discordId: 'discord-user-1',
  role: 'user',
  twoFactorEnabled: false,
  failedTwoFactorAttempts: 0,
  failedLoginAttempts: 0,
  profileViews: 0,
  loginCount: 0,
  rsiVerified: false,
  manualVerificationRequested: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: () => mockRepository,
  },
}));

describe('UserProfileService', () => {
  const mockProfileLookup = (user: User | null) => {
    const lookupBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };

    mockRepository.createQueryBuilder.mockReturnValue(lookupBuilder);
    return lookupBuilder;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates cryptographically strong verification tokens', () => {
    const service = new UserProfileService() as unknown as {
      generateVerificationToken: () => string;
    };

    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const token = service.generateVerificationToken();
      expect(token).toMatch(/^[a-f0-9]{64}$/);
      tokens.add(token);
    }

    expect(tokens.size).toBe(100);
  });

  it('throws ConflictError when updating to an already used email', async () => {
    const service = new UserProfileService();
    jest.spyOn(service, 'getUserByEmail').mockResolvedValue(createMockUser({ id: 'other-user' }));

    await expect(
      service.updateEmail('current-user', 'duplicate@example.com')
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when requesting email verification for a missing user', async () => {
    const service = new UserProfileService();
    mockProfileLookup(null);

    await expect(service.requestEmailVerification('missing-user')).rejects.toBeInstanceOf(
      NotFoundError
    );
  });

  it('returns a private payload for private profiles when viewed by another user', async () => {
    const service = new UserProfileService();
    const lookupBuilder = mockProfileLookup(
      createMockUser({
        id: 'target-user',
        username: 'target',
        displayName: 'Target User',
        avatar: 'https://example.com/avatar.png',
        preferences: {
          privacy: {
            profileVisibility: 'private',
          },
        },
      })
    );

    const profile = await service.getPublicProfile('target-user', 'viewer-user');

    expect(lookupBuilder.where).toHaveBeenCalledWith('user.username = :identifier', {
      identifier: 'target-user',
    });

    expect(profile).toEqual({
      id: 'target-user',
      username: 'target',
      displayName: 'Target User',
      avatar: 'https://example.com/avatar.png',
      isPrivateProfile: true,
      showShips: false,
      showActivity: false,
    });
  });

  it('supports username identifier lookup for public profiles', async () => {
    const service = new UserProfileService();
    const lookupBuilder = mockProfileLookup(
      createMockUser({
        id: 'target-user',
        username: 'target',
        displayName: 'Target User',
        avatar: undefined,
        bio: 'Hello',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        lastLoginAt: new Date('2026-01-02T00:00:00Z'),
        rsiHandle: 'captain-target',
        rsiVerified: true,
        preferences: {
          privacy: {
            profileVisibility: 'public',
            showOrganizations: false,
            showActivity: false,
            showPublicShips: true,
            showRsiInfo: true,
            showVerifiedBadge: true,
          },
        },
      })
    );

    const profile = await service.getPublicProfile('target', 'viewer-user');

    expect(lookupBuilder.where).toHaveBeenCalledWith('user.username = :identifier', {
      identifier: 'target',
    });
    expect(profile).toEqual(
      expect.objectContaining({
        id: 'target-user',
        username: 'target',
        isPrivateProfile: false,
        showOrganizations: false,
        showActivity: false,
        showShips: true,
      })
    );
    expect(profile?.organizations).toEqual([]);
  });

  it('increments profile views with one atomic update query', async () => {
    const service = new UserProfileService();
    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    mockRepository.createQueryBuilder.mockReturnValue(updateBuilder);

    await service.incrementProfileViews('target-user', 'viewer-user');

    expect(updateBuilder.update).toHaveBeenCalled();
    expect(updateBuilder.set).toHaveBeenCalledWith({
      profileViews: expect.any(Function),
      lastProfileViewAt: expect.any(Function),
    });
    expect(updateBuilder.where).toHaveBeenCalledWith('id = :userId', { userId: 'target-user' });
    expect(updateBuilder.execute).toHaveBeenCalledTimes(1);
    expect(mockRepository.increment).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('does not allow updateProfile to mutate active organization', async () => {
    const service = new UserProfileService();
    const existingUser = createMockUser({
      id: 'user-1',
      activeOrgId: 'org-1',
      displayName: 'Initial Name',
    });

    mockProfileLookup(existingUser);
    mockRepository.save.mockImplementation(async (user: User) => user);

    const result = await service.updateProfile('user-1', {
      activeOrgId: 'org-2',
      displayName: 'Updated Name',
    });

    expect(mockRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOrgId: 'org-1',
        displayName: 'Updated Name',
      })
    );
    expect(result.activeOrgId).toBe('org-1');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

