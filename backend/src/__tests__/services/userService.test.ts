// Mock TypeORM before imports
import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';
const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

// Mock the domain services to prevent side effects
jest.mock('../../services/user/UserPreferencesService', () => ({
  UserPreferencesService: jest.fn().mockImplementation(() => ({
    resetPreferences: jest.fn(),
    getUserPreferences: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('../../services/user/UserSocialService', () => ({
  UserSocialService: jest.fn().mockImplementation(() => ({
    logSocialActivity: jest.fn(),
    getSocialStats: jest.fn().mockResolvedValue({}),
  })),
  SocialActivityType: {
    PROFILE_VIEW: 'profile_view',
    FRIEND_REQUEST_SENT: 'friend_request_sent',
    FRIEND_REQUEST_RECEIVED: 'friend_request_received',
    FRIEND_ADDED: 'friend_added',
    USER_FOLLOWED: 'user_followed',
    USER_UNFOLLOWED: 'user_unfollowed',
    MESSAGE_SENT: 'message_sent',
    GROUP_JOINED: 'group_joined',
    ORGANIZATION_JOINED: 'organization_joined',
  },
}));

jest.mock('../../services/user/UserProfileService', () => ({
  UserProfileService: jest.fn().mockImplementation(() => ({
    getProfileActivity: jest.fn().mockResolvedValue({}),
    getUserByEmail: jest.fn(),
  })),
}));

import { User } from '../../models/User';
import { UserService } from '../../services/user/UserService';

describe('UserService', () => {
  let userService: UserService;
  let mockUsers: Partial<User>[];

  beforeEach(() => {
    // Reset mock data
    mockUsers = [];

    // Setup User repository mock with smart data handling
    const mockRepo = createMockRepositoryWithData(mockUsers);
    mockDataSource.getRepository.mockReturnValue(mockRepo);

    userService = new UserService();
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user', async () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        discordId: 'discord123',
        role: 'user',
      };

      const result = await userService.createUser(user);
      expect(result).toEqual(user);
    });
  });

  describe('getUserById', () => {
    it('should return a user by ID', async () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        discordId: 'discord123',
        role: 'user',
      };

      await userService.createUser(user);
      const result = await userService.getUserById('1');
      expect(result).toEqual(user);
    });

    it('should return null if user not found', async () => {
      const result = await userService.getUserById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('updateUser', () => {
    it('should update an existing user', async () => {
      const user: User = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        discordId: 'discord123',
        role: 'user',
      };

      await userService.createUser(user);

      const updatedData: User = {
        id: '1',
        username: 'updateduser',
        email: 'updated@example.com',
        discordId: 'discord123',
        role: 'user',
      };

      const result = await userService.updateUser('1', updatedData);
      expect(result.username).toBe('updateduser');
      expect(result.email).toBe('updated@example.com');
    });

    it('should throw an error if user to update not found', async () => {
      const updatedData: User = {
        id: 'nonexistent',
        username: 'updateduser',
        email: 'updated@example.com',
        discordId: 'discord123',
        role: 'user',
      };

      await expect(userService.updateUser('nonexistent', updatedData)).rejects.toThrow(
        'User not found'
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
