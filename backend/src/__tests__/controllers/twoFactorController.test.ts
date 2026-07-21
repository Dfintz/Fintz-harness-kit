/**
 * TwoFactorController Unit Tests
 *
 * Tests two-factor authentication setup, verification, and management
 * Critical security feature testing
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { TwoFactorController } from '../../controllers/twoFactorController';
import { MockResponse } from '../helpers/testHelpers.helper';
import { TwoFactorService } from '../../services/authentication/TwoFactorService';
import { UserService } from '../../services/user/UserService';

// Mock dependencies
jest.mock('../../services/authentication/TwoFactorService');
jest.mock('../../services/user/UserService');
describe('TwoFactorController', () => {
  let controller: TwoFactorController;
  let mockTwoFactorService: jest.Mocked<TwoFactorService>;
  let mockUserService: jest.Mocked<UserService>;

  // Helper to create authenticated request
  const createAuthRequest = (overrides: any = {}) => ({
    user: { id: 'test-user-id', username: 'testuser', role: 'user' },
    body: {},
    params: {},
    query: {},
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mocked service instances
    mockTwoFactorService = {
      generateSecret: jest.fn(),
      verifyToken: jest.fn(),
      hashBackupCodes: jest.fn(),
      verifyBackupCode: jest.fn(),
      removeBackupCode: jest.fn(),
      generateBackupCodes: jest.fn(),
      checkLockout: jest.fn(),
      trackFailedAttempt: jest.fn(),
      resetFailedAttempts: jest.fn(),
    } as any;

    mockUserService = {
      getUserById: jest.fn(),
      updateUser: jest.fn(),
    } as any;

    controller = new TwoFactorController();
    (controller as any).twoFactorService = mockTwoFactorService;
    (controller as any).userService = mockUserService;
  });

  describe('setupTwoFactor', () => {
    it('should generate secret and QR code successfully', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorEnabled: false };
      const mockSetup = {
        secret: 'ABCD1234SECRET',
        qrCodeUrl: 'data:image/png;base64,QRCODE',
        backupCodes: ['code1', 'code2', 'code3'],
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.generateSecret.mockResolvedValue(mockSetup);
      mockUserService.updateUser.mockResolvedValue({} as any);

      await controller.setupTwoFactor(req as any, res);

      expect(mockUserService.getUserById).toHaveBeenCalledWith('test-user-id');
      expect(mockTwoFactorService.generateSecret).toHaveBeenCalledWith('testuser');
      expect(mockUserService.updateUser).toHaveBeenCalledWith('test-user-id', {
        twoFactorSecret: 'ABCD1234SECRET',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        secret: 'ABCD1234SECRET',
        qrCodeUrl: 'data:image/png;base64,QRCODE',
        backupCodes: ['code1', 'code2', 'code3'],
      });
    });

    it('should return 401 if user not authenticated', async () => {
      const req = createAuthRequest({ user: undefined });
      const res = MockResponse.create();

      await controller.setupTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if user not found', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      mockUserService.getUserById.mockResolvedValue(null);

      await controller.setupTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should return 400 if 2FA is already enabled', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorEnabled: true };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.setupTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('already enabled'),
        })
      );
    });
  });

  describe('verifyAndEnableTwoFactor', () => {
    it('should verify token and enable 2FA successfully', async () => {
      const req = createAuthRequest({
        body: { token: '123456', backupCodes: ['code1', 'code2'] },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorSecret: 'SECRET', twoFactorEnabled: false };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(true);
      mockTwoFactorService.hashBackupCodes.mockReturnValue(['hashed1', 'hashed2']);
      mockUserService.updateUser.mockResolvedValue({} as any);

      await controller.verifyAndEnableTwoFactor(req as any, res);

      expect(mockTwoFactorService.verifyToken).toHaveBeenCalledWith('SECRET', '123456');
      expect(mockTwoFactorService.hashBackupCodes).toHaveBeenCalledWith(['code1', 'code2']);
      expect(mockUserService.updateUser).toHaveBeenCalledWith('test-user-id', {
        twoFactorEnabled: true,
        backupCodes: ['hashed1', 'hashed2'],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: '2FA has been enabled successfully',
        twoFactorEnabled: true,
      });
    });

    it('should return 400 if token is invalid', async () => {
      const req = createAuthRequest({
        body: { token: 'wrong', backupCodes: ['code1'] },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorSecret: 'SECRET' };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(false);

      await controller.verifyAndEnableTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if backup codes not an array', async () => {
      const req = createAuthRequest({
        body: { token: '123456', backupCodes: 'not-array' },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorSecret: 'SECRET' };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.verifyAndEnableTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if setup not initiated', async () => {
      const req = createAuthRequest({
        body: { token: '123456', backupCodes: ['code1'] },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorSecret: null };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.verifyAndEnableTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('initiate 2FA setup first'),
        })
      );
    });
  });

  describe('disableTwoFactor', () => {
    it('should disable 2FA with valid token', async () => {
      const req = createAuthRequest({
        body: { token: '123456' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['hashed1'],
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(true);
      mockUserService.updateUser.mockResolvedValue({} as any);

      await controller.disableTwoFactor(req as any, res);

      expect(mockUserService.updateUser).toHaveBeenCalledWith('test-user-id', {
        twoFactorEnabled: false,
        twoFactorSecret: undefined,
        backupCodes: undefined,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: '2FA has been disabled successfully',
        twoFactorEnabled: false,
      });
    });

    it('should disable 2FA with valid backup code', async () => {
      const req = createAuthRequest({
        body: { backupCode: 'backup123' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['hashed1'],
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyBackupCode.mockReturnValue(true);
      mockUserService.updateUser.mockResolvedValue({} as any);

      await controller.disableTwoFactor(req as any, res);

      expect(mockTwoFactorService.verifyBackupCode).toHaveBeenCalledWith('backup123', ['hashed1']);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 if 2FA is not enabled', async () => {
      const req = createAuthRequest({
        body: { token: '123456' },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorEnabled: false };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.disableTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('2FA is not enabled'),
        })
      );
    });

    it('should return 400 if neither token nor backup code provided', async () => {
      const req = createAuthRequest({
        body: {},
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.disableTwoFactor(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('verifyTwoFactorLogin', () => {
    it('should verify login with valid token', async () => {
      const req = createAuthRequest({
        body: { userId: 'test-user-id', token: '123456' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['hashed1', 'hashed2'],
      };
      mockTwoFactorService.checkLockout.mockResolvedValue({
        isLocked: false,
        remainingAttempts: 5,
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(true);
      mockTwoFactorService.resetFailedAttempts.mockResolvedValue(undefined);

      await controller.verifyTwoFactorLogin(req as any, res);

      expect(mockTwoFactorService.checkLockout).toHaveBeenCalledWith('test-user-id');
      expect(mockTwoFactorService.verifyToken).toHaveBeenCalledWith('SECRET', '123456');
      expect(mockTwoFactorService.resetFailedAttempts).toHaveBeenCalledWith('test-user-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: '2FA verification successful',
        verified: true,
        usedBackupCode: false,
        remainingBackupCodes: undefined,
      });
    });

    it('should return 429 if account is locked', async () => {
      const req = createAuthRequest({
        body: { userId: 'test-user-id', token: '123456' },
      });
      const res = MockResponse.create();
      const lockedUntil = new Date(Date.now() + 300000); // 5 minutes from now
      mockTwoFactorService.checkLockout.mockResolvedValue({
        isLocked: true,
        lockedUntil,
        remainingAttempts: 0,
      });

      await controller.verifyTwoFactorLogin(req as any, res);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Account temporarily locked'),
          lockedUntil,
        })
      );
    });

    it('should track failed attempts and warn user', async () => {
      const req = createAuthRequest({
        body: { userId: 'test-user-id', token: 'wrong' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
      };
      mockTwoFactorService.checkLockout.mockResolvedValue({
        isLocked: false,
        remainingAttempts: 5,
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(false);
      mockTwoFactorService.trackFailedAttempt.mockResolvedValue(undefined);
      mockTwoFactorService.checkLockout
        .mockResolvedValueOnce({ isLocked: false, remainingAttempts: 5 })
        .mockResolvedValueOnce({ isLocked: false, remainingAttempts: 2 });

      await controller.verifyTwoFactorLogin(req as any, res);

      expect(mockTwoFactorService.trackFailedAttempt).toHaveBeenCalledWith('test-user-id');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid verification code',
          remainingAttempts: 2,
          warning: expect.stringContaining('Account will be locked'),
        })
      );
    });

    it('should verify with backup code and remove used code', async () => {
      const req = createAuthRequest({
        body: { userId: 'test-user-id', backupCode: 'backup123' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
        backupCodes: ['hashed1', 'hashed2'],
      };
      mockTwoFactorService.checkLockout.mockResolvedValue({
        isLocked: false,
        remainingAttempts: 5,
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyBackupCode.mockReturnValue(true);
      mockTwoFactorService.removeBackupCode.mockReturnValue(['hashed2']);
      mockUserService.updateUser.mockResolvedValue({} as any);
      mockTwoFactorService.resetFailedAttempts.mockResolvedValue(undefined);

      await controller.verifyTwoFactorLogin(req as any, res);

      expect(mockTwoFactorService.verifyBackupCode).toHaveBeenCalledWith('backup123', [
        'hashed1',
        'hashed2',
      ]);
      expect(mockTwoFactorService.removeBackupCode).toHaveBeenCalledWith('backup123', [
        'hashed1',
        'hashed2',
      ]);
      expect(mockUserService.updateUser).toHaveBeenCalledWith('test-user-id', {
        backupCodes: ['hashed2'],
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          verified: true,
          usedBackupCode: true,
          remainingBackupCodes: 1,
        })
      );
    });

    it('should return 400 if 2FA not enabled for user', async () => {
      const req = createAuthRequest({
        body: { userId: 'test-user-id', token: '123456' },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorEnabled: false };
      mockTwoFactorService.checkLockout.mockResolvedValue({
        isLocked: false,
        remainingAttempts: 5,
      });
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.verifyTwoFactorLogin(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('generateNewBackupCodes', () => {
    it('should generate new backup codes successfully', async () => {
      const req = createAuthRequest({
        body: { token: '123456' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
      };
      const newCodes = ['new1', 'new2', 'new3'];
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(true);
      mockTwoFactorService.generateBackupCodes.mockReturnValue(newCodes);
      mockTwoFactorService.hashBackupCodes.mockReturnValue(['hashed1', 'hashed2', 'hashed3']);
      mockUserService.updateUser.mockResolvedValue({} as any);

      await controller.generateNewBackupCodes(req as any, res);

      expect(mockTwoFactorService.generateBackupCodes).toHaveBeenCalledWith(10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'New backup codes generated successfully',
        backupCodes: newCodes,
      });
    });

    it('should return 400 if token is missing', async () => {
      const req = createAuthRequest({
        body: {},
      });
      const res = MockResponse.create();

      await controller.generateNewBackupCodes(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if token is invalid', async () => {
      const req = createAuthRequest({
        body: { token: 'wrong' },
      });
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        twoFactorSecret: 'SECRET',
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);
      mockTwoFactorService.verifyToken.mockReturnValue(false);

      await controller.generateNewBackupCodes(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 400 if 2FA is not enabled', async () => {
      const req = createAuthRequest({
        body: { token: '123456' },
      });
      const res = MockResponse.create();
      const mockUser = { id: 'test-user-id', twoFactorEnabled: false };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.generateNewBackupCodes(req as any, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getTwoFactorStatus', () => {
    it('should return 2FA status with backup codes info', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: true,
        backupCodes: ['code1', 'code2', 'code3'],
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.getTwoFactorStatus(req as any, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        twoFactorEnabled: true,
        hasBackupCodes: true,
        backupCodesCount: 3,
      });
    });

    it('should return status when 2FA is disabled', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      const mockUser = {
        id: 'test-user-id',
        twoFactorEnabled: false,
        backupCodes: null,
      };
      mockUserService.getUserById.mockResolvedValue(mockUser as any);

      await controller.getTwoFactorStatus(req as any, res);

      // hasBackupCodes evaluates null && null.length > 0 which is falsy (null)
      expect(res.json).toHaveBeenCalledWith({
        twoFactorEnabled: false,
        hasBackupCodes: null, // null && anything is null
        backupCodesCount: 0,
      });
    });

    it('should return 401 if not authenticated', async () => {
      const req = createAuthRequest({ user: undefined });
      const res = MockResponse.create();

      await controller.getTwoFactorStatus(req as any, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 404 if user not found', async () => {
      const req = createAuthRequest();
      const res = MockResponse.create();
      mockUserService.getUserById.mockResolvedValue(null);

      await controller.getTwoFactorStatus(req as any, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
