import { AppDataSource } from '../../data-source';
import { User } from '../../models/User';
import { WebAuthnCredential } from '../../models/WebAuthnCredential';
import { WebAuthnService } from '../authentication/WebAuthnService';

// Mock dependencies
jest.mock('../../config/database');
// Mock Redis cache
jest.mock('../../utils/redis', () => ({
  cache: {
    get: jest.fn(() => Promise.resolve(null)), // Default: return null (not found in cache)
    set: jest.fn(() => Promise.resolve(false)), // Default: return false (use fallback)
    del: jest.fn(() => Promise.resolve(true)),
    getStatus: jest.fn(() => ({ connected: false, enabled: true })),
  },
}));

// Mock @simplewebauthn/server
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

describe('WebAuthnService', () => {
  let webAuthnService: WebAuthnService;
  let mockCredentialRepo: any;
  let mockUserRepo: any;

  const testUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  } as User;

  const testMetadata = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock credential repository
    mockCredentialRepo = {
      create: jest.fn(data => ({ ...data })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(() => Promise.resolve([])),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      count: jest.fn(() => Promise.resolve(0)),
    };

    // Mock user repository
    mockUserRepo = {
      findOne: jest.fn(),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === WebAuthnCredential) {
        return mockCredentialRepo;
      }
      if (entity === User) {
        return mockUserRepo;
      }
      return {};
    });

    // Create service instance
    webAuthnService = new WebAuthnService();
  });

  afterEach(() => {
    webAuthnService.destroy();
  });

  describe('Registration Flow', () => {
    describe('generateRegistrationOptions', () => {
      it('should generate registration options for a user', async () => {
        const { generateRegistrationOptions } = require('@simplewebauthn/server');
        const mockOptions = {
          challenge: 'test-challenge',
          rp: { name: 'Star Citizen Fleet Manager', id: 'localhost' },
          user: { id: 'user-123', name: 'testuser', displayName: 'testuser' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          timeout: 60000,
          attestation: 'none',
        };
        (generateRegistrationOptions as jest.Mock).mockResolvedValue(mockOptions);

        const result = await webAuthnService.generateRegistrationOptions(
          testUser.id,
          testUser.username
        );

        expect(result).toHaveProperty('challenge');
        expect(result.rp.name).toBe('Star Citizen Fleet Manager');
        expect(generateRegistrationOptions).toHaveBeenCalled();
      });

      it('should exclude existing credentials', async () => {
        const { generateRegistrationOptions } = require('@simplewebauthn/server');
        const existingCredential = {
          id: 'cred-1',
          credentialId: 'existing-credential-id',
          transports: ['usb'],
        };
        mockCredentialRepo.find.mockResolvedValue([existingCredential]);
        (generateRegistrationOptions as jest.Mock).mockResolvedValue({
          challenge: 'test-challenge',
        });

        await webAuthnService.generateRegistrationOptions(testUser.id, testUser.username);

        expect(generateRegistrationOptions).toHaveBeenCalledWith(
          expect.objectContaining({
            excludeCredentials: expect.arrayContaining([
              expect.objectContaining({
                id: 'existing-credential-id',
              }),
            ]),
          })
        );
      });
    });

    describe('verifyRegistration', () => {
      it('should verify registration and store credential', async () => {
        const {
          verifyRegistrationResponse,
          generateRegistrationOptions,
        } = require('@simplewebauthn/server');

        // First generate options to store challenge
        (generateRegistrationOptions as jest.Mock).mockResolvedValue({
          challenge: 'test-challenge',
        });
        await webAuthnService.generateRegistrationOptions(testUser.id, testUser.username);

        // Mock verification response
        // In @simplewebauthn/server v10+, credential.id is Base64URLString, publicKey is Uint8Array
        const mockCredentialId = 'AQIDBA'; // base64url of [1,2,3,4]
        const mockPublicKey = new Uint8Array([5, 6, 7, 8]);

        (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
          verified: true,
          registrationInfo: {
            credential: {
              id: mockCredentialId,
              publicKey: mockPublicKey,
              counter: 0,
              type: 'public-key',
            },
            aaguid: '00000000-0000-0000-0000-000000000000',
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            fmt: 'none',
          },
        });

        mockCredentialRepo.findOne.mockResolvedValue(null); // No existing credential

        const mockResponse = {
          id: 'credential-id',
          rawId: 'credential-id',
          response: {
            clientDataJSON: 'test',
            attestationObject: 'test',
            transports: ['usb'],
          },
          type: 'public-key',
          clientExtensionResults: {},
          authenticatorAttachment: 'cross-platform',
        };

        const result = await webAuthnService.verifyRegistration(
          testUser.id,
          mockResponse as any,
          'My Security Key',
          testMetadata
        );

        expect(result.verified).toBe(true);
        expect(result.deviceName).toBe('My Security Key');
        expect(mockCredentialRepo.save).toHaveBeenCalled();
      });

      it('should reject duplicate credential', async () => {
        const {
          verifyRegistrationResponse,
          generateRegistrationOptions,
        } = require('@simplewebauthn/server');

        (generateRegistrationOptions as jest.Mock).mockResolvedValue({
          challenge: 'test-challenge',
        });
        await webAuthnService.generateRegistrationOptions(testUser.id, testUser.username);

        const mockCredentialId = 'AQIDBA'; // base64url string in v10+
        (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
          verified: true,
          registrationInfo: {
            credential: {
              id: mockCredentialId,
              publicKey: new Uint8Array([5, 6, 7, 8]),
              counter: 0,
              type: 'public-key',
            },
            aaguid: '00000000-0000-0000-0000-000000000000',
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            fmt: 'none',
          },
        });

        // Mock existing credential found
        mockCredentialRepo.findOne.mockResolvedValue({ id: 'existing' });

        await expect(webAuthnService.verifyRegistration(testUser.id, {} as any)).rejects.toThrow(
          'Credential already registered'
        );
      });

      it('should throw error for missing challenge', async () => {
        await expect(webAuthnService.verifyRegistration(testUser.id, {} as any)).rejects.toThrow(
          'Registration challenge not found or expired'
        );
      });
    });
  });

  describe('Authentication Flow', () => {
    describe('generateAuthenticationOptions', () => {
      it('should generate authentication options for user', async () => {
        const { generateAuthenticationOptions } = require('@simplewebauthn/server');
        const mockCredentials = [
          { credentialId: 'cred-1', transports: ['usb'] },
          { credentialId: 'cred-2', transports: ['internal'] },
        ];
        mockCredentialRepo.find.mockResolvedValue(mockCredentials);

        (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
          challenge: 'auth-challenge',
          allowCredentials: [
            { id: 'cred-1', type: 'public-key' },
            { id: 'cred-2', type: 'public-key' },
          ],
        });

        const result = await webAuthnService.generateAuthenticationOptions(testUser.id);

        expect(result).toHaveProperty('challenge');
        expect(generateAuthenticationOptions).toHaveBeenCalledWith(
          expect.objectContaining({
            allowCredentials: expect.any(Array),
          })
        );
      });

      it('should throw error if user has no credentials', async () => {
        mockCredentialRepo.find.mockResolvedValue([]);

        await expect(webAuthnService.generateAuthenticationOptions(testUser.id)).rejects.toThrow(
          'No WebAuthn credentials registered for this user'
        );
      });

      it('should allow any credential for discoverable credentials flow', async () => {
        const { generateAuthenticationOptions } = require('@simplewebauthn/server');
        (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
          challenge: 'auth-challenge',
        });

        const result = await webAuthnService.generateAuthenticationOptions();

        expect(result).toHaveProperty('challenge');
        expect(generateAuthenticationOptions).toHaveBeenCalledWith(
          expect.objectContaining({
            allowCredentials: undefined,
          })
        );
      });
    });

    describe('verifyAuthentication', () => {
      it('should verify authentication and update counter', async () => {
        const {
          verifyAuthenticationResponse,
          generateAuthenticationOptions,
        } = require('@simplewebauthn/server');

        // Generate options to store challenge
        mockCredentialRepo.find.mockResolvedValue([{ credentialId: 'cred-1', transports: [] }]);
        (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
          challenge: 'auth-challenge',
        });
        await webAuthnService.generateAuthenticationOptions(testUser.id);

        // Mock credential lookup
        const mockCredential = {
          id: 'cred-1',
          userId: testUser.id,
          credentialId: 'cred-1',
          credentialPublicKey: 'public-key',
          counter: 0,
          transports: ['usb'],
          useCount: 5,
        };
        mockCredentialRepo.findOne.mockResolvedValue(mockCredential);

        (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
          verified: true,
          authenticationInfo: {
            newCounter: 1,
          },
        });

        const mockResponse = {
          id: 'cred-1',
          rawId: 'cred-1',
          response: {
            clientDataJSON: 'test',
            authenticatorData: 'test',
            signature: 'test',
          },
          type: 'public-key',
        };

        const result = await webAuthnService.verifyAuthentication(mockResponse as any, testUser.id);

        expect(result.verified).toBe(true);
        expect(result.userId).toBe(testUser.id);
        expect(result.newCounter).toBe(1);
        expect(mockCredentialRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            counter: 1,
            useCount: 6,
          })
        );
      });

      it('should throw error for invalid credential', async () => {
        const { generateAuthenticationOptions } = require('@simplewebauthn/server');

        mockCredentialRepo.find.mockResolvedValue([{ credentialId: 'cred-1', transports: [] }]);
        (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
          challenge: 'auth-challenge',
        });
        await webAuthnService.generateAuthenticationOptions(testUser.id);

        mockCredentialRepo.findOne.mockResolvedValue(null); // Credential not found

        await expect(
          webAuthnService.verifyAuthentication({ id: 'invalid-cred' } as any, testUser.id)
        ).rejects.toThrow('Credential not found');
      });

      it('should store credentialId as base64url and match during authentication', async () => {
        const {
          verifyRegistrationResponse,
          verifyAuthenticationResponse,
          generateRegistrationOptions,
          generateAuthenticationOptions,
        } = require('@simplewebauthn/server');

        // === REGISTRATION ===
        (generateRegistrationOptions as jest.Mock).mockResolvedValue({
          challenge: 'reg-challenge',
        });
        await webAuthnService.generateRegistrationOptions(testUser.id, testUser.username);

        // credential.id in v10+ is a Base64URLString, not Uint8Array
        const credIdBase64url = 'dGVzdC1jcmVkZW50aWFsLWlk';

        (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
          verified: true,
          registrationInfo: {
            credential: {
              id: credIdBase64url,
              publicKey: new Uint8Array([5, 6, 7, 8]),
              counter: 0,
            },
            aaguid: '00000000-0000-0000-0000-000000000000',
            credentialDeviceType: 'singleDevice',
            credentialBackedUp: false,
            credentialType: 'public-key',
            fmt: 'none',
          },
        });
        mockCredentialRepo.findOne.mockResolvedValue(null);

        await webAuthnService.verifyRegistration(
          testUser.id,
          {
            id: credIdBase64url,
            rawId: credIdBase64url,
            response: { clientDataJSON: 't', attestationObject: 't', transports: [] },
            type: 'public-key',
            clientExtensionResults: {},
            authenticatorAttachment: 'platform',
          } as any,
          'Test Device',
          testMetadata
        );

        // Verify the stored credentialId is the SAME base64url string (not double-encoded)
        const savedEntity = mockCredentialRepo.save.mock.calls[0][0];
        expect(savedEntity.credentialId).toBe(credIdBase64url);

        // === AUTHENTICATION ===
        mockCredentialRepo.find.mockResolvedValue([
          { credentialId: credIdBase64url, transports: [] },
        ]);
        (generateAuthenticationOptions as jest.Mock).mockResolvedValue({
          challenge: 'auth-challenge',
        });
        await webAuthnService.generateAuthenticationOptions(testUser.id);

        // Simulate the browser sending the same credentialId during authentication
        mockCredentialRepo.findOne.mockResolvedValue({
          id: 'uuid-1',
          userId: testUser.id,
          credentialId: credIdBase64url,
          credentialPublicKey: Buffer.from([5, 6, 7, 8]).toString('base64url'),
          counter: 0,
          transports: [],
          useCount: 0,
        });

        (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
          verified: true,
          authenticationInfo: { newCounter: 1 },
        });

        // The browser sends the same base64url credential ID
        const result = await webAuthnService.verifyAuthentication(
          {
            id: credIdBase64url,
            rawId: credIdBase64url,
            response: { clientDataJSON: 't', authenticatorData: 't', signature: 't' },
            type: 'public-key',
          } as any,
          testUser.id
        );

        expect(result.verified).toBe(true);
        // Confirm findOne was called with the same base64url used during registration
        expect(mockCredentialRepo.findOne).toHaveBeenCalledWith({
          where: { credentialId: credIdBase64url, isActive: true },
        });
      });
    });
  });

  describe('Credential Management', () => {
    describe('getUserCredentials', () => {
      it('should return user credentials', async () => {
        const mockCredentials = [
          {
            id: 'cred-1',
            deviceName: 'YubiKey',
            createdAt: new Date(),
            lastUsedAt: new Date(),
            useCount: 10,
            backedUp: false,
            transports: ['usb'],
          },
          {
            id: 'cred-2',
            deviceName: 'Touch ID',
            createdAt: new Date(),
            lastUsedAt: new Date(),
            useCount: 25,
            backedUp: true,
            transports: ['internal'],
          },
        ];
        mockCredentialRepo.find.mockResolvedValue(mockCredentials);

        const result = await webAuthnService.getUserCredentials(testUser.id);

        expect(result).toHaveLength(2);
        expect(result[0]).toHaveProperty('deviceName', 'YubiKey');
        expect(result[1]).toHaveProperty('backedUp', true);
      });
    });

    describe('updateCredentialName', () => {
      it('should update credential name', async () => {
        const mockCredential = { id: 'cred-1', userId: testUser.id, deviceName: 'Old Name' };
        mockCredentialRepo.findOne.mockResolvedValue(mockCredential);

        await webAuthnService.updateCredentialName(testUser.id, 'cred-1', 'New Security Key');

        expect(mockCredentialRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ deviceName: 'New Security Key' })
        );
      });

      it('should throw error for non-existent credential', async () => {
        mockCredentialRepo.findOne.mockResolvedValue(null);

        await expect(
          webAuthnService.updateCredentialName(testUser.id, 'invalid', 'Name')
        ).rejects.toThrow('Credential not found');
      });
    });

    describe('removeCredential', () => {
      it('should soft delete credential', async () => {
        const mockCredential = { id: 'cred-1', userId: testUser.id, isActive: true };
        mockCredentialRepo.findOne.mockResolvedValue(mockCredential);

        await webAuthnService.removeCredential(testUser.id, 'cred-1');

        expect(mockCredentialRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ isActive: false })
        );
      });
    });

    describe('removeAllCredentials', () => {
      it('should remove all user credentials', async () => {
        mockCredentialRepo.update.mockResolvedValue({ affected: 3 });

        const result = await webAuthnService.removeAllCredentials(testUser.id);

        expect(result).toBe(3);
        expect(mockCredentialRepo.update).toHaveBeenCalledWith(
          { userId: testUser.id, isActive: true },
          { isActive: false }
        );
      });
    });

    describe('hasCredentials', () => {
      it('should return true if user has credentials', async () => {
        mockCredentialRepo.count.mockResolvedValue(2);

        const result = await webAuthnService.hasCredentials(testUser.id);

        expect(result).toBe(true);
      });

      it('should return false if user has no credentials', async () => {
        mockCredentialRepo.count.mockResolvedValue(0);

        const result = await webAuthnService.hasCredentials(testUser.id);

        expect(result).toBe(false);
      });
    });
  });

  describe('Configuration', () => {
    it('should return service configuration', () => {
      const config = webAuthnService.getConfig();

      expect(config).toHaveProperty('rpName', 'Star Citizen Fleet Manager');
      expect(config).toHaveProperty('rpId', 'localhost');
      expect(config).toHaveProperty('origin');
      expect(config).toHaveProperty('timeout');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

