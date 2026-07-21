import crypto from 'crypto';

import { Secret, TOTP } from 'otpauth';
import QRCode from 'qrcode';

import { TwoFactorService } from '../../services/authentication/TwoFactorService';
import { UserService } from '../../services/user/UserService';

// Mock dependencies
jest.mock('../../services/user/UserService');
jest.mock('qrcode');
describe('TwoFactorService', () => {
  let twoFactorService: TwoFactorService;
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUserService = new UserService() as jest.Mocked<UserService>;
    twoFactorService = new TwoFactorService();
    (twoFactorService as any).userService = mockUserService;
  });

  describe('generateSecret', () => {
    it('should generate secret with QR code and backup codes', async () => {
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,mockqrcode');

      const result = await twoFactorService.generateSecret('testuser');

      // Verify QR code was generated with an otpauth:// URL
      expect(QRCode.toDataURL).toHaveBeenCalledWith(expect.stringContaining('otpauth://totp/'));
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCodeUrl');
      expect(result).toHaveProperty('backupCodes');
      expect(result.backupCodes).toHaveLength(10);
      // Secret should be a valid base32 string
      expect(result.secret).toMatch(/^[A-Z2-7]+=*$/);
      expect(result.qrCodeUrl).toBe('data:image/png;base64,mockqrcode');
    });

    it('should generate secret with custom issuer', async () => {
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,mockqrcode');

      await twoFactorService.generateSecret('testuser', 'Custom Issuer');

      expect(QRCode.toDataURL).toHaveBeenCalledWith(
        expect.stringContaining('issuer=Custom%20Issuer')
      );
    });

    it('should generate unique backup codes', async () => {
      (QRCode.toDataURL as jest.Mock).mockResolvedValue('data:image/png;base64,mockqrcode');

      const result1 = await twoFactorService.generateSecret('user1');
      const result2 = await twoFactorService.generateSecret('user2');

      // Backup codes should be different for different users
      expect(result1.backupCodes).not.toEqual(result2.backupCodes);
    });

    it('should handle QR code generation failure', async () => {
      (QRCode.toDataURL as jest.Mock).mockRejectedValue(new Error('QR generation failed'));

      await expect(twoFactorService.generateSecret('testuser')).rejects.toThrow(
        'QR generation failed'
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify valid TOTP token', () => {
      // Generate a real TOTP token using the same library
      const secret = Secret.fromBase32('JBSWY3DPEHPK3PXP');
      const totp = new TOTP({ secret, algorithm: 'SHA1', digits: 6, period: 30 });
      const validToken = totp.generate();

      const result = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', validToken);

      expect(result).toBe(true);
    });

    it('should reject invalid TOTP token', () => {
      // Test with a clearly invalid token that cannot validate
      // Use a non-numeric token to ensure it fails deterministically
      const result1 = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', 'invalid');
      expect(result1).toBe(false);

      // Test with wrong-length token
      const result2 = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', '12345');
      expect(result2).toBe(false);

      // Test with modified token - generate valid token and modify a digit to make it invalid
      // This is deterministic because we know the modified token cannot match the original
      const correctSecret = Secret.fromBase32('JBSWY3DPEHPK3PXP');
      const totp = new TOTP({ secret: correctSecret, algorithm: 'SHA1', digits: 6, period: 30 });
      const validToken = totp.generate();
      expect(validToken).toBeTruthy();
      expect(validToken.length).toBe(6);
      expect(validToken).toMatch(/^\d{6}$/); // Ensure 6 numeric digits
      // Modify the first digit to create an invalid token (increment and wrap around if needed)
      const firstDigit = parseInt(validToken[0], 10);
      const modifiedDigit = (firstDigit + 1) % 10;
      const invalidToken = modifiedDigit + validToken.slice(1);

      const result3 = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', invalidToken);
      // Modified token should always fail validation (deterministically false)
      expect(result3).toBe(false);
    });

    it('should handle empty token', () => {
      const result = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', '');

      expect(result).toBe(false);
    });

    it('should handle malformed token', () => {
      const result = twoFactorService.verifyToken('JBSWY3DPEHPK3PXP', 'abc123');

      expect(result).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate 10 backup codes by default', () => {
      const codes = twoFactorService.generateBackupCodes();

      expect(codes).toHaveLength(10);
      expect(codes.every(code => code.length === 8)).toBe(true);
      expect(codes.every(code => /^[0-9A-F]+$/.test(code))).toBe(true);
    });

    it('should generate custom number of backup codes', () => {
      const codes = twoFactorService.generateBackupCodes(5);

      expect(codes).toHaveLength(5);
    });

    it('should generate unique codes', () => {
      const codes = twoFactorService.generateBackupCodes(10);
      const uniqueCodes = new Set(codes);

      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should generate uppercase hexadecimal codes', () => {
      const codes = twoFactorService.generateBackupCodes(10);

      codes.forEach(code => {
        expect(code).toMatch(/^[0-9A-F]{8}$/);
        expect(code).toBe(code.toUpperCase());
      });
    });
  });

  describe('hashBackupCodes', () => {
    it('should hash backup codes using SHA256', () => {
      const codes = ['ABCD1234', 'EFGH5678'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      expect(hashed).toHaveLength(2);
      expect(hashed[0]).toBe(crypto.createHash('sha256').update('ABCD1234').digest('hex'));
      expect(hashed[1]).toBe(crypto.createHash('sha256').update('EFGH5678').digest('hex'));
    });

    it('should produce different hashes for different codes', () => {
      const codes = ['CODE1111', 'CODE2222'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      expect(hashed[0]).not.toBe(hashed[1]);
    });

    it('should handle empty array', () => {
      const hashed = twoFactorService.hashBackupCodes([]);

      expect(hashed).toHaveLength(0);
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify valid backup code', () => {
      const codes = ['ABCD1234'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      const result = twoFactorService.verifyBackupCode('ABCD1234', hashed);

      expect(result).toBe(true);
    });

    it('should reject invalid backup code', () => {
      const codes = ['ABCD1234'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      const result = twoFactorService.verifyBackupCode('WRONG123', hashed);

      expect(result).toBe(false);
    });

    it('should be case-insensitive', () => {
      const codes = ['ABCD1234'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      const resultUpper = twoFactorService.verifyBackupCode('ABCD1234', hashed);
      const resultLower = twoFactorService.verifyBackupCode('abcd1234', hashed);

      expect(resultUpper).toBe(true);
      expect(resultLower).toBe(true);
    });

    it('should handle empty hashed codes list', () => {
      const result = twoFactorService.verifyBackupCode('ABCD1234', []);

      expect(result).toBe(false);
    });
  });

  describe('removeBackupCode', () => {
    it('should remove used backup code', () => {
      const codes = ['CODE1111', 'CODE2222', 'CODE3333'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      const remaining = twoFactorService.removeBackupCode('CODE2222', hashed);

      expect(remaining).toHaveLength(2);
      expect(twoFactorService.verifyBackupCode('CODE2222', remaining)).toBe(false);
      expect(twoFactorService.verifyBackupCode('CODE1111', remaining)).toBe(true);
      expect(twoFactorService.verifyBackupCode('CODE3333', remaining)).toBe(true);
    });

    it('should be case-insensitive when removing', () => {
      const codes = ['CODE1111'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      const remaining = twoFactorService.removeBackupCode('code1111', hashed);

      expect(remaining).toHaveLength(0);
    });

    it('should not remove non-existent code', () => {
      const codes = ['CODE1111', 'CODE2222'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      const remaining = twoFactorService.removeBackupCode('CODE9999', hashed);

      expect(remaining).toHaveLength(2);
    });

    it('should handle removing from empty list', () => {
      const remaining = twoFactorService.removeBackupCode('CODE1111', []);

      expect(remaining).toHaveLength(0);
    });
  });

  describe('trackFailedAttempt', () => {
    it('should track first failed attempt', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 0,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      await twoFactorService.trackFailedAttempt('user-123');

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        failedTwoFactorAttempts: 1,
        twoFactorLockedUntil: undefined,
      });
    });

    it('should lockout after 5 attempts for 15 minutes', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 4,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      await twoFactorService.trackFailedAttempt('user-123');

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        failedTwoFactorAttempts: 5,
        twoFactorLockedUntil: expect.any(Date),
      });

      const updateCall = (mockUserService.updateUser as jest.Mock).mock.calls[0][1];
      const lockoutDuration = updateCall.twoFactorLockedUntil.getTime() - Date.now();
      expect(lockoutDuration).toBeGreaterThan(14 * 60 * 1000); // ~15 minutes
      expect(lockoutDuration).toBeLessThan(16 * 60 * 1000);
    });

    it('should lockout after 10 attempts for 1 hour', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 9,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      await twoFactorService.trackFailedAttempt('user-123');

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        failedTwoFactorAttempts: 10,
        twoFactorLockedUntil: expect.any(Date),
      });

      const updateCall = (mockUserService.updateUser as jest.Mock).mock.calls[0][1];
      const lockoutDuration = updateCall.twoFactorLockedUntil.getTime() - Date.now();
      expect(lockoutDuration).toBeGreaterThan(59 * 60 * 1000); // ~1 hour
      expect(lockoutDuration).toBeLessThan(61 * 60 * 1000);
    });

    it('should lockout after 15 attempts for 24 hours', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 14,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      await twoFactorService.trackFailedAttempt('user-123');

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        failedTwoFactorAttempts: 15,
        twoFactorLockedUntil: expect.any(Date),
      });

      const updateCall = (mockUserService.updateUser as jest.Mock).mock.calls[0][1];
      const lockoutDuration = updateCall.twoFactorLockedUntil.getTime() - Date.now();
      expect(lockoutDuration).toBeGreaterThan(23.5 * 60 * 60 * 1000); // ~24 hours
      expect(lockoutDuration).toBeLessThan(24.5 * 60 * 60 * 1000);
    });

    it('should handle user not found', async () => {
      mockUserService.getUserById = jest.fn().mockRejectedValue(new Error('User not found'));

      await expect(twoFactorService.trackFailedAttempt('nonexistent')).rejects.toThrow(
        'User not found'
      );
    });

    it('should handle update failure', async () => {
      const mockUser = { id: 'user-123', failedTwoFactorAttempts: 0 };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockRejectedValue(new Error('Update failed'));

      await expect(twoFactorService.trackFailedAttempt('user-123')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('checkLockout', () => {
    it('should return not locked for new user', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 0,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(15);
      expect(status.attemptCount).toBe(0);
    });

    it('should return locked status when locked', async () => {
      const lockedUntil = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 10,
        twoFactorLockedUntil: lockedUntil,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.lockedUntil).toEqual(lockedUntil);
      expect(status.remainingAttempts).toBe(0);
      expect(status.attemptCount).toBe(10);
    });

    it('should clear expired lockout', async () => {
      const expiredLockout = new Date(Date.now() - 60 * 1000); // 1 minute ago
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 10,
        twoFactorLockedUntil: expiredLockout,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(15);
      expect(status.attemptCount).toBe(0);
      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        failedTwoFactorAttempts: 0,
        twoFactorLockedUntil: undefined,
      });
    });

    it('should calculate remaining attempts correctly', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 3,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(12); // 15 - 3
      expect(status.attemptCount).toBe(3);
    });

    it('should fail secure on error', async () => {
      mockUserService.getUserById = jest.fn().mockRejectedValue(new Error('Database error'));

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.remainingAttempts).toBe(0);
    });

    it('should handle null lockout date', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 2,
        twoFactorLockedUntil: null,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.remainingAttempts).toBe(13);
    });
  });

  describe('resetFailedAttempts', () => {
    it('should reset failed attempts on successful verification', async () => {
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      await twoFactorService.resetFailedAttempts('user-123');

      expect(mockUserService.updateUser).toHaveBeenCalledWith('user-123', {
        failedTwoFactorAttempts: 0,
        twoFactorLockedUntil: undefined,
      });
    });

    it('should handle reset failure', async () => {
      mockUserService.updateUser = jest.fn().mockRejectedValue(new Error('Update failed'));

      await expect(twoFactorService.resetFailedAttempts('user-123')).rejects.toThrow(
        'Update failed'
      );
    });
  });

  describe('calculateLockoutDuration', () => {
    it('should return 15 minutes for 5 attempts', () => {
      const duration = twoFactorService.calculateLockoutDuration(5);

      expect(duration).toBe(15 * 60 * 1000);
    });

    it('should return 1 hour for 10 attempts', () => {
      const duration = twoFactorService.calculateLockoutDuration(10);

      expect(duration).toBe(60 * 60 * 1000);
    });

    it('should return 24 hours for 15 attempts', () => {
      const duration = twoFactorService.calculateLockoutDuration(15);

      expect(duration).toBe(24 * 60 * 60 * 1000);
    });

    it('should return 0 for less than 5 attempts', () => {
      expect(twoFactorService.calculateLockoutDuration(0)).toBe(0);
      expect(twoFactorService.calculateLockoutDuration(4)).toBe(0);
    });

    it('should return 24 hours for more than 15 attempts', () => {
      const duration = twoFactorService.calculateLockoutDuration(100);

      expect(duration).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent brute force with progressive lockout', async () => {
      const mockUser = {
        id: 'attacker',
        failedTwoFactorAttempts: 0,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      // Simulate 15 failed attempts
      for (let i = 0; i < 15; i++) {
        mockUser.failedTwoFactorAttempts = i;
        await twoFactorService.trackFailedAttempt('attacker');
      }

      // Check final lockout status
      const finalUpdate = (mockUserService.updateUser as jest.Mock).mock.calls[14][1];
      expect(finalUpdate.failedTwoFactorAttempts).toBe(15);
      expect(finalUpdate.twoFactorLockedUntil).toBeDefined();

      // Verify lockout is 24 hours
      const lockoutDuration = finalUpdate.twoFactorLockedUntil.getTime() - Date.now();
      expect(lockoutDuration).toBeGreaterThan(23.5 * 60 * 60 * 1000);
    });

    it('should handle backup code exhaustion', () => {
      const codes = ['CODE1', 'CODE2', 'CODE3'];
      let hashed = twoFactorService.hashBackupCodes(codes);

      // Use all backup codes
      hashed = twoFactorService.removeBackupCode('CODE1', hashed);
      hashed = twoFactorService.removeBackupCode('CODE2', hashed);
      hashed = twoFactorService.removeBackupCode('CODE3', hashed);

      expect(hashed).toHaveLength(0);
      expect(twoFactorService.verifyBackupCode('CODE1', hashed)).toBe(false);
    });

    it('should not allow reuse of backup codes', () => {
      const codes = ['CODE1111'];
      let hashed = twoFactorService.hashBackupCodes(codes);

      // First use - should work
      expect(twoFactorService.verifyBackupCode('CODE1111', hashed)).toBe(true);

      // Remove the code
      hashed = twoFactorService.removeBackupCode('CODE1111', hashed);

      // Second use - should fail
      expect(twoFactorService.verifyBackupCode('CODE1111', hashed)).toBe(false);
    });

    it('should handle timing attacks on backup code verification', () => {
      const codes = ['AAAA1111', 'BBBB2222'];
      const hashed = twoFactorService.hashBackupCodes(codes);

      // Both should take similar time regardless of match
      const start1 = Date.now();
      twoFactorService.verifyBackupCode('AAAA1111', hashed);
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      twoFactorService.verifyBackupCode('ZZZZ9999', hashed);
      const time2 = Date.now() - start2;

      // Time difference should be minimal (< 10ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent failed attempts', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 0,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      // Simulate concurrent attempts
      const promises = [
        twoFactorService.trackFailedAttempt('user-123'),
        twoFactorService.trackFailedAttempt('user-123'),
        twoFactorService.trackFailedAttempt('user-123'),
      ];

      await Promise.all(promises);

      expect(mockUserService.updateUser).toHaveBeenCalledTimes(3);
    });

    it('should handle very long lockout periods', async () => {
      const mockUser = {
        id: 'user-123',
        failedTwoFactorAttempts: 100,
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);
      mockUserService.updateUser = jest.fn().mockResolvedValue(undefined);

      await twoFactorService.trackFailedAttempt('user-123');

      const updateCall = (mockUserService.updateUser as jest.Mock).mock.calls[0][1];
      expect(updateCall.twoFactorLockedUntil).toBeDefined();
      expect(updateCall.failedTwoFactorAttempts).toBe(101);
    });

    it('should handle undefined failedAttempts', async () => {
      const mockUser = {
        id: 'user-123',
        // failedTwoFactorAttempts is undefined
      };

      mockUserService.getUserById = jest.fn().mockResolvedValue(mockUser);

      const status = await twoFactorService.checkLockout('user-123');

      expect(status.attemptCount).toBe(0);
      expect(status.remainingAttempts).toBe(15);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
