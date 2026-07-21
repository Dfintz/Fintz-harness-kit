import { AuthenticationService } from '../../services/authentication';
import { startRefreshTokenCleanup } from '../../utils/cleanupJobs';

// Mock the service and logger
jest.mock('../../services/authentication');
describe('Cleanup Jobs', () => {
  let mockAuthService: jest.Mocked<AuthenticationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAuthService = new AuthenticationService() as jest.Mocked<AuthenticationService>;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('startRefreshTokenCleanup', () => {
    it('should start the cleanup job', () => {
      const interval = startRefreshTokenCleanup();

      expect(interval).toBeDefined();

      clearInterval(interval);
    });

    it('should run cleanup at specified intervals', async () => {
      mockAuthService.cleanupExpiredTokens = jest.fn().mockResolvedValue(5);

      // Override the service instance in the module
      jest.spyOn(AuthenticationService.prototype, 'cleanupExpiredTokens').mockResolvedValue(5);

      const interval = startRefreshTokenCleanup(1); // 1 hour interval

      // Fast-forward time by 1 hour
      jest.advanceTimersByTime(1 * 60 * 60 * 1000);

      // Wait for async operations
      await Promise.resolve();

      clearInterval(interval);
    });

    it('should handle errors during cleanup', async () => {
      jest
        .spyOn(AuthenticationService.prototype, 'cleanupExpiredTokens')
        .mockRejectedValue(new Error('Database error'));

      const interval = startRefreshTokenCleanup(1);

      // Fast-forward time by 1 hour
      jest.advanceTimersByTime(1 * 60 * 60 * 1000);

      // Wait for async operations
      await Promise.resolve();

      clearInterval(interval);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
