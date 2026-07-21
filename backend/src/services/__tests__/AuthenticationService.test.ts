import jwt from 'jsonwebtoken';

import { AppDataSource } from '../../data-source';
import { RefreshToken } from '../../models/RefreshToken';
import { TokenBlacklist } from '../../models/TokenBlacklist';
import { User } from '../../models/User';
import { UserSession } from '../../models/UserSession';
import { AuthenticationService, SessionMetadata } from '../authentication/AuthenticationService';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../security');

describe('AuthenticationService', () => {
  let authService: AuthenticationService;
  let mockRefreshTokenRepo: any;
  let mockSessionRepo: any;
  let mockBlacklistRepo: any;
  let mockEncryptionService: any;

  // Test user
  const testUser: User = {
    id: 'user-123',
    username: 'testuser',
    role: 'user',
    email: 'test@example.com',
  } as User;

  const testMetadata: SessionMetadata = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    location: 'US',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock encryption service
    mockEncryptionService = {
      encrypt: jest.fn((token: string) => ({
        encrypted: `encrypted-${token}`,
        iv: 'test-iv',
        authTag: 'test-auth-tag',
      })),
      decrypt: jest.fn((encrypted: string) => 'decrypted-token'),
    };

    // Mock repositories
    mockRefreshTokenRepo = {
      create: jest.fn(data => ({ ...data, id: 1 })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 1 })),
      })),
      count: jest.fn(() => Promise.resolve(0)),
    };

    mockSessionRepo = {
      create: jest.fn(data => ({ ...data, id: 1 })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 1 })),
      })),
      count: jest.fn(() => Promise.resolve(0)),
    };

    mockBlacklistRepo = {
      create: jest.fn(data => data),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        delete: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn(() => Promise.resolve({ affected: 1 })),
      })),
      count: jest.fn(() => Promise.resolve(0)),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === RefreshToken) {
        return mockRefreshTokenRepo;
      }
      if (entity === UserSession) {
        return mockSessionRepo;
      }
      if (entity === TokenBlacklist) {
        return mockBlacklistRepo;
      }
      return {};
    });

    // Mock getTokenEncryptionService
    const { getTokenEncryptionService } = require('../security');
    (getTokenEncryptionService as jest.Mock).mockReturnValue(mockEncryptionService);

    // Create service instance
    authService = new AuthenticationService();
  });

  describe('Token Generation and Validation', () => {
    describe('generateTokens', () => {
      it('should generate access token and refresh token pair', async () => {
        const result = await authService.generateTokens(testUser, testMetadata);

        expect(result).toHaveProperty('accessToken');
        expect(result).toHaveProperty('refreshToken');
        expect(result).toHaveProperty('expiresIn');
        expect(typeof result.accessToken).toBe('string');
        expect(typeof result.refreshToken).toBe('string');
        expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
      });

      it('should include user info in access token', async () => {
        const result = await authService.generateTokens(testUser);
        const decoded: any = jwt.decode(result.accessToken);

        expect(decoded.id).toBe(testUser.id);
        expect(decoded.username).toBe(testUser.username);
        expect(decoded.role).toBe(testUser.role);
        expect(decoded).toHaveProperty('jti');
      });

      it('should create refresh token with metadata', async () => {
        await authService.generateTokens(testUser, testMetadata);

        const savedToken = mockRefreshTokenRepo.save.mock.calls[0][0];
        expect(savedToken.userId).toBe(testUser.id);
        expect(savedToken.ipAddress).toBe(testMetadata.ipAddress);
        expect(savedToken.userAgent).toBe(testMetadata.userAgent);
        expect(savedToken.location).toBe(testMetadata.location);
      });
    });

    describe('validateAccessToken', () => {
      it('should validate and decode valid token', async () => {
        const tokens = await authService.generateTokens(testUser);
        mockBlacklistRepo.findOne.mockResolvedValue(null);

        const result = await authService.validateAccessToken(tokens.accessToken);

        expect(result.id).toBe(testUser.id);
        expect(result.username).toBe(testUser.username);
        expect(result.role).toBe(testUser.role);
      });

      it('should reject expired token', async () => {
        // Create expired token (JWT treats negative expiration as expired)
        const expiredToken = jwt.sign(
          { id: testUser.id, username: testUser.username, role: testUser.role, jti: 'test-jti' },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '-1s' }
        );

        // Negative expiration results in TokenExpiredError which throws "Token expired"
        await expect(authService.validateAccessToken(expiredToken)).rejects.toThrow(
          'Token expired'
        );
      });

      it('should reject blacklisted token', async () => {
        const tokens = await authService.generateTokens(testUser);
        const decoded: any = jwt.decode(tokens.accessToken);

        // Mock token as blacklisted
        mockBlacklistRepo.findOne.mockResolvedValue({ jti: decoded.jti });

        await expect(authService.validateAccessToken(tokens.accessToken)).rejects.toThrow(
          'Token has been revoked'
        );
      });

      it('should reject invalid token signature', async () => {
        const invalidToken = jwt.sign(
          { id: testUser.id, username: testUser.username, role: testUser.role, jti: 'test-jti' },
          'wrong-secret',
          { expiresIn: '15m' }
        );

        await expect(authService.validateAccessToken(invalidToken)).rejects.toThrow(
          'Invalid token'
        );
      });

      it('should reject a token signed with a non-allowlisted algorithm (SEC-05)', async () => {
        // Signed with the CORRECT secret but HS512 instead of HS256. Verification
        // pins algorithms to ['HS256'], so this algorithm-confusion attempt (CWE-347)
        // must be rejected even though the secret and signature are otherwise valid.
        const wrongAlgToken = jwt.sign(
          { id: testUser.id, username: testUser.username, role: testUser.role, jti: 'test-jti' },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '15m', algorithm: 'HS512' }
        );

        await expect(authService.validateAccessToken(wrongAlgToken)).rejects.toThrow(
          'Invalid token'
        );
      });
    });

    describe('revokeAccessToken', () => {
      it('should add token to blacklist', async () => {
        const tokens = await authService.generateTokens(testUser);
        mockBlacklistRepo.findOne.mockResolvedValue(null);

        await authService.revokeAccessToken(tokens.accessToken, 'logout', testMetadata);

        expect(mockBlacklistRepo.save).toHaveBeenCalled();
        const savedEntry = mockBlacklistRepo.save.mock.calls[0][0];
        expect(savedEntry.reason).toBe('logout');
        expect(savedEntry.ipAddress).toBe(testMetadata.ipAddress);
      });

      it('should not add duplicate blacklist entry', async () => {
        const tokens = await authService.generateTokens(testUser);
        const decoded: any = jwt.decode(tokens.accessToken);

        // Mock token as already blacklisted
        mockBlacklistRepo.findOne.mockResolvedValue({ jti: decoded.jti });

        await authService.revokeAccessToken(tokens.accessToken, 'logout');

        // Should not save again
        expect(mockBlacklistRepo.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('Refresh Token Management', () => {
    describe('generateRefreshToken', () => {
      it('should generate encrypted refresh token', async () => {
        const result = await authService.generateRefreshToken(
          testUser.id,
          testMetadata.ipAddress,
          testMetadata.userAgent,
          undefined,
          testMetadata.location
        );

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshTokenRecord');
        expect(mockEncryptionService.encrypt).toHaveBeenCalled();
        expect(mockRefreshTokenRepo.save).toHaveBeenCalled();
      });

      it('should create new family ID if no parent', async () => {
        const result = await authService.generateRefreshToken(testUser.id);

        const savedToken = mockRefreshTokenRepo.save.mock.calls[0][0];
        expect(savedToken.familyId).toBeDefined();
        expect(savedToken.parentTokenId).toBeUndefined();
      });

      it('should inherit family ID from parent token', async () => {
        const parentToken = {
          id: 1,
          familyId: 'family-123',
          userId: testUser.id,
          tokenHash: 'hash',
          expiresAt: new Date(),
          revoked: false,
        } as unknown as RefreshToken;

        await authService.generateRefreshToken(testUser.id, undefined, undefined, parentToken);

        const savedToken = mockRefreshTokenRepo.save.mock.calls[0][0];
        expect(savedToken.familyId).toBe('family-123');
        expect(savedToken.parentTokenId).toBe(1);
      });
    });

    describe('verifyRefreshToken', () => {
      it('should return token if valid', async () => {
        const mockToken = {
          id: 1,
          userId: testUser.id,
          tokenHash: 'test-hash',
          revoked: false,
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        };

        mockRefreshTokenRepo.findOne.mockResolvedValue(mockToken);

        const result = await authService.verifyRefreshToken('test-token');

        expect(result).toEqual(mockToken);
      });

      it('should return null if token not found', async () => {
        mockRefreshTokenRepo.findOne.mockResolvedValue(null);

        const result = await authService.verifyRefreshToken('invalid-token');

        expect(result).toBeNull();
      });

      it('should return null if token revoked', async () => {
        const mockToken = {
          id: 1,
          revoked: true,
          expiresAt: new Date(Date.now() + 86400000),
        };

        mockRefreshTokenRepo.findOne.mockResolvedValue(mockToken);

        const result = await authService.verifyRefreshToken('revoked-token');

        expect(result).toBeNull();
      });

      it('should return null if token expired', async () => {
        const mockToken = {
          id: 1,
          revoked: false,
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
        };

        mockRefreshTokenRepo.findOne.mockResolvedValue(mockToken);

        const result = await authService.verifyRefreshToken('expired-token');

        expect(result).toBeNull();
      });
    });

    describe('rotateRefreshToken', () => {
      it('should generate new token and revoke old one', async () => {
        const oldToken = {
          id: 1,
          userId: testUser.id,
          familyId: 'family-123',
          tokenHash: 'old-hash',
          revoked: false,
          expiresAt: new Date(Date.now() + 86400000),
        };

        mockRefreshTokenRepo.findOne.mockResolvedValue(oldToken);

        const result = await authService.rotateRefreshToken(
          'old-token',
          testMetadata.ipAddress,
          testMetadata.userAgent
        );

        expect(result).toHaveProperty('token');
        expect(result).toHaveProperty('refreshTokenRecord');
        expect(oldToken.revoked).toBe(true);
        expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(oldToken);
      });

      it('should detect token reuse and revoke family', async () => {
        const reuseToken = {
          id: 1,
          userId: testUser.id,
          familyId: 'family-123',
          revoked: true, // Already revoked
          expiresAt: new Date(Date.now() + 86400000),
        };

        mockRefreshTokenRepo.findOne.mockResolvedValue(reuseToken);

        await expect(authService.rotateRefreshToken('reused-token')).rejects.toThrow(
          'Token reuse detected'
        );

        expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
          { familyId: 'family-123', revoked: false },
          expect.objectContaining({ revoked: true })
        );
      });

      it('should return null for invalid token', async () => {
        mockRefreshTokenRepo.findOne.mockResolvedValue(null);

        const result = await authService.rotateRefreshToken('invalid-token');

        expect(result).toBeNull();
      });

      // F5: rotation family-continuity + linkage invariants. These guard the
      // mechanism that makes reuse/breach detection work across a rotation chain:
      // every rotated token must stay in the same family and point back to its
      // parent, and the old token must be fully marked replaced. generateRefreshToken
      // tests family inheritance in isolation, but only the rotation flow wires the
      // old token in as the parent — a refactor dropping that wiring would silently
      // break breach detection yet pass the generation-level test.
      it('keeps the rotated token in the same family as the old token (continuity)', async () => {
        const oldToken = {
          id: 1,
          userId: testUser.id,
          familyId: 'family-abc',
          tokenHash: 'old-hash',
          revoked: false,
          expiresAt: new Date(Date.now() + 86400000),
        };
        mockRefreshTokenRepo.findOne.mockResolvedValue(oldToken);

        const result = await authService.rotateRefreshToken('old-token');

        expect(result).not.toBeNull();
        // The NEW token record must inherit the old token's family + point at its parent.
        expect(result?.refreshTokenRecord.familyId).toBe('family-abc');
        expect(result?.refreshTokenRecord.parentTokenId).toBe(1);
      });

      it('marks the old token replaced and revoked when rotated', async () => {
        const oldToken = {
          id: 1,
          userId: testUser.id,
          familyId: 'family-abc',
          tokenHash: 'old-hash',
          revoked: false,
          expiresAt: new Date(Date.now() + 86400000),
        } as Partial<RefreshToken> as RefreshToken & { replacedByToken?: string };
        mockRefreshTokenRepo.findOne.mockResolvedValue(oldToken);
        // Give the freshly created token a distinct id so the linkage is observable.
        mockRefreshTokenRepo.create.mockImplementationOnce((data: Partial<RefreshToken>) => ({
          ...data,
          id: 'new-token-id',
        }));

        await authService.rotateRefreshToken('old-token');

        expect(oldToken.revoked).toBe(true);
        expect(oldToken.revokedAt).toBeInstanceOf(Date);
        expect(oldToken.replacedByToken).toBe('new-token-id');
      });

      it('returns null for an expired (but not revoked) old token without revoking the family', async () => {
        const expiredToken = {
          id: 1,
          userId: testUser.id,
          familyId: 'family-abc',
          tokenHash: 'old-hash',
          revoked: false,
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
        };
        mockRefreshTokenRepo.findOne.mockResolvedValue(expiredToken);

        const result = await authService.rotateRefreshToken('expired-token');

        expect(result).toBeNull();
        // Expiry is not a breach: the family must NOT be revoked and no new token issued.
        expect(mockRefreshTokenRepo.update).not.toHaveBeenCalled();
        expect(mockRefreshTokenRepo.create).not.toHaveBeenCalled();
      });

      it('does not issue a new token when reuse is detected', async () => {
        const reuseToken = {
          id: 1,
          userId: testUser.id,
          familyId: 'family-abc',
          revoked: true,
          expiresAt: new Date(Date.now() + 86400000),
        };
        mockRefreshTokenRepo.findOne.mockResolvedValue(reuseToken);

        await expect(authService.rotateRefreshToken('reused-token')).rejects.toThrow(
          'Token reuse detected'
        );

        // Breach throws before any replacement token is created.
        expect(mockRefreshTokenRepo.create).not.toHaveBeenCalled();
      });
    });

    describe('revokeTokenFamily', () => {
      it('should revoke all tokens in family', async () => {
        mockRefreshTokenRepo.update.mockResolvedValue({ affected: 3 });

        const result = await authService.revokeTokenFamily('family-123');

        expect(result).toBe(3);
        expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
          { familyId: 'family-123', revoked: false },
          expect.objectContaining({ revoked: true })
        );
      });
    });

    describe('revokeAllUserTokens', () => {
      it('should revoke all user tokens', async () => {
        mockRefreshTokenRepo.update.mockResolvedValue({ affected: 5 });

        const result = await authService.revokeAllUserTokens(testUser.id);

        expect(result).toBe(5);
        expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(
          { userId: testUser.id, revoked: false },
          expect.objectContaining({ revoked: true })
        );
      });
    });

    describe('revokeRefreshTokenById', () => {
      it('should revoke token by ID with ownership validation', async () => {
        const tokenId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        const mockToken = {
          id: tokenId,
          userId: testUser.id,
          tokenHash: 'hash123',
          revoked: false,
        };
        mockRefreshTokenRepo.findOne.mockResolvedValue(mockToken);
        mockRefreshTokenRepo.save.mockResolvedValue({
          ...mockToken,
          revoked: true,
          revokedAt: expect.any(Date),
        });

        const result = await authService.revokeRefreshTokenById(tokenId, testUser.id);

        expect(result).toBe(true);
        expect(mockRefreshTokenRepo.findOne).toHaveBeenCalledWith({
          where: { id: tokenId, userId: testUser.id },
        });
        expect(mockRefreshTokenRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            revoked: true,
            revokedAt: expect.any(Date),
          })
        );
      });

      it('should return false when token not found', async () => {
        const tokenId = 'f9e8d7c6-b5a4-4321-8765-fedcba987654';
        mockRefreshTokenRepo.findOne.mockResolvedValue(null);

        const result = await authService.revokeRefreshTokenById(tokenId, testUser.id);

        expect(result).toBe(false);
        expect(mockRefreshTokenRepo.save).not.toHaveBeenCalled();
      });

      it('should return false when token belongs to different user', async () => {
        const tokenId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        mockRefreshTokenRepo.findOne.mockResolvedValue(null);

        const result = await authService.revokeRefreshTokenById(tokenId, 'other-user');

        expect(result).toBe(false);
        expect(mockRefreshTokenRepo.findOne).toHaveBeenCalledWith({
          where: { id: tokenId, userId: 'other-user' },
        });
      });

      it('should return false when token already revoked', async () => {
        const tokenId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
        const mockToken = {
          id: tokenId,
          userId: testUser.id,
          revoked: true,
        };
        mockRefreshTokenRepo.findOne.mockResolvedValue(mockToken);

        const result = await authService.revokeRefreshTokenById(tokenId, testUser.id);

        expect(result).toBe(false);
        expect(mockRefreshTokenRepo.save).not.toHaveBeenCalled();
      });
    });

    describe('getUserRefreshTokens', () => {
      it('should return active tokens for user', async () => {
        const mockTokens = [
          {
            id: 1,
            familyId: 'family-1',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            ipAddress: '192.168.1.1',
          },
          {
            id: 2,
            familyId: 'family-2',
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 86400000),
            userAgent: 'Chrome',
          },
        ];

        mockRefreshTokenRepo.find.mockResolvedValue(mockTokens);

        const result = await authService.getUserRefreshTokens(testUser.id);

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('familyId');
      });
    });
  });

  describe('Session Management', () => {
    const discordTokens = {
      access_token: 'discord-access-token',
      refresh_token: 'discord-refresh-token',
      expires_in: 604800,
    };

    describe('createSession', () => {
      it('should create new session with Discord tokens', async () => {
        const result = await authService.createSession(
          1,
          'session-token-123',
          discordTokens,
          testMetadata
        );

        expect(mockSessionRepo.save).toHaveBeenCalled();
        const savedSession = mockSessionRepo.save.mock.calls[0][0];
        expect(savedSession.userId).toBe(1);
        expect(savedSession.sessionToken).toBe('session-token-123');
        expect(savedSession.discordAccessToken).toBe(discordTokens.access_token);
        expect(savedSession.ipAddress).toBe(testMetadata.ipAddress);
      });

      it('should set expiration timestamps', async () => {
        await authService.createSession(1, 'session-token', discordTokens);

        const savedSession = mockSessionRepo.save.mock.calls[0][0];
        expect(savedSession.expiresAt).toBeInstanceOf(Date);
        expect(savedSession.discordTokenExpiry).toBeInstanceOf(Date);
        expect(savedSession.lastActivity).toBeInstanceOf(Date);
      });
    });

    describe('getSession', () => {
      it('should return active session', async () => {
        const mockSession = {
          id: 1,
          sessionToken: 'test-token',
          isActive: true,
        };

        mockSessionRepo.findOne.mockResolvedValue(mockSession);

        const result = await authService.getSession('test-token');

        expect(result).toEqual(mockSession);
        expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
          where: { sessionToken: 'test-token', isActive: true },
        });
      });
    });

    describe('getUserSessions', () => {
      it('should return all active user sessions', async () => {
        const mockSessions = [
          {
            id: 1,
            sessionToken: 'token-1',
            userId: 1,
            lastActivity: new Date(),
            expiresAt: new Date(),
            isActive: true,
          },
          {
            id: 2,
            sessionToken: 'token-2',
            userId: 1,
            lastActivity: new Date(),
            expiresAt: new Date(),
            isActive: true,
          },
        ];

        mockSessionRepo.find.mockResolvedValue(mockSessions);

        const result = await authService.getUserSessions(1);

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('sessionToken');
      });
    });

    describe('updateActivity', () => {
      it('should update session last activity', async () => {
        const mockSession = {
          id: 1,
          sessionToken: 'test-token',
          lastActivity: new Date(Date.now() - 3600000),
        };

        mockSessionRepo.findOne.mockResolvedValue(mockSession);

        await authService.updateActivity('test-token');

        expect(mockSessionRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ sessionToken: 'test-token' })
        );
      });
    });

    describe('isSessionValid', () => {
      it('should return true for valid session', () => {
        const validSession = {
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
          lastActivity: new Date(Date.now() - 60000), // 1 minute ago
          sessionToken: 'test',
        } as UserSession;

        const result = authService.isSessionValid(validSession);

        expect(result).toBe(true);
      });

      it('should return false for absolutely expired session', () => {
        const expiredSession = {
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
          lastActivity: new Date(),
          sessionToken: 'test',
        } as UserSession;

        const result = authService.isSessionValid(expiredSession);

        expect(result).toBe(false);
      });

      it('should return false for idle expired session', () => {
        const idleSession = {
          expiresAt: new Date(Date.now() + 86400000), // Tomorrow
          lastActivity: new Date(Date.now() - 18000000), // 5 hours ago (exceeds 4h idle timeout)
          sessionToken: 'test',
        } as UserSession;

        const result = authService.isSessionValid(idleSession);

        expect(result).toBe(false);
      });
    });

    describe('terminateSession', () => {
      it('should deactivate session', async () => {
        await authService.terminateSession('test-token');

        expect(mockSessionRepo.update).toHaveBeenCalledWith(
          { sessionToken: 'test-token' },
          { isActive: false }
        );
      });
    });

    describe('terminateAllUserSessions', () => {
      it('should deactivate all user sessions', async () => {
        mockSessionRepo.update.mockResolvedValue({ affected: 3 });

        const result = await authService.terminateAllUserSessions(1);

        expect(result).toBe(3);
        expect(mockSessionRepo.update).toHaveBeenCalledWith(
          { userId: 1, isActive: true },
          { isActive: false }
        );
      });
    });

    describe('terminateSessionById', () => {
      it('should terminate session by ID with ownership validation', async () => {
        const mockSession = {
          id: 123,
          userId: 1,
          sessionToken: 'test-token',
          isActive: true,
        };
        mockSessionRepo.findOne.mockResolvedValue(mockSession);
        mockSessionRepo.save.mockResolvedValue({
          ...mockSession,
          isActive: false,
        });

        const result = await authService.terminateSessionById(123, 1);

        expect(result).toBe(true);
        expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
          where: { id: 123, userId: 1, isActive: true },
        });
        expect(mockSessionRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            isActive: false,
          })
        );
      });

      it('should return false when session not found', async () => {
        mockSessionRepo.findOne.mockResolvedValue(null);

        const result = await authService.terminateSessionById(999, 1);

        expect(result).toBe(false);
        expect(mockSessionRepo.save).not.toHaveBeenCalled();
      });

      it('should return false when session belongs to different user', async () => {
        mockSessionRepo.findOne.mockResolvedValue(null);

        const result = await authService.terminateSessionById(123, 999);

        expect(result).toBe(false);
        expect(mockSessionRepo.findOne).toHaveBeenCalledWith({
          where: { id: 123, userId: 999, isActive: true },
        });
      });

      it('should return false when session already inactive', async () => {
        mockSessionRepo.findOne.mockResolvedValue(null);

        const result = await authService.terminateSessionById(123, 1);

        expect(result).toBe(false);
        expect(mockSessionRepo.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup and Maintenance', () => {
    describe('cleanupExpiredTokens', () => {
      it('should delete expired refresh tokens', async () => {
        const result = await authService.cleanupExpiredTokens();

        expect(result).toBe(1);
        expect(mockRefreshTokenRepo.createQueryBuilder).toHaveBeenCalled();
      });
    });

    describe('cleanupExpiredSessions', () => {
      it('should deactivate expired sessions', async () => {
        const result = await authService.cleanupExpiredSessions();

        expect(result).toBe(1);
        expect(mockSessionRepo.createQueryBuilder).toHaveBeenCalled();
      });
    });

    describe('cleanupExpiredBlacklist', () => {
      it('should delete expired blacklist entries', async () => {
        const result = await authService.cleanupExpiredBlacklist();

        expect(result).toBe(1);
        expect(mockBlacklistRepo.createQueryBuilder).toHaveBeenCalled();
      });
    });
  });

  describe('Service Statistics', () => {
    describe('getStats', () => {
      it('should return service statistics', async () => {
        mockSessionRepo.count.mockResolvedValue(10);
        mockRefreshTokenRepo.count.mockResolvedValue(20);
        mockBlacklistRepo.count.mockResolvedValue(5);

        const result = await authService.getStats();

        expect(result).toEqual({
          activeSessions: 10,
          activeRefreshTokens: 20,
          blacklistedTokens: 5,
          cacheSize: expect.any(Number),
        });
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

