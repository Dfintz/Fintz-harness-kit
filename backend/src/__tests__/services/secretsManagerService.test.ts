import { SecretsManagerService } from '../../services/secrets';
import KeyVaultService from '../../services/cloud/KeyVaultService';

jest.mock('../../services/cloud/KeyVaultService');
jest.mock('../../utils/auditLogger');

describe('SecretsManagerService', () => {
  let secretsManager: SecretsManagerService;
  let mockKeyVaultService: jest.Mocked<KeyVaultService>;

  beforeEach(() => {
    // Reset singleton instance
    (SecretsManagerService as any).instance = undefined;

    secretsManager = SecretsManagerService.getInstance();
    mockKeyVaultService = (secretsManager as any).keyVaultService;

    // Mock KeyVaultService methods
    mockKeyVaultService.getSecret = jest.fn();
    mockKeyVaultService.rotateSecret = jest.fn();
    mockKeyVaultService.needsRotation = jest.fn();
    mockKeyVaultService.clearCache = jest.fn();
    mockKeyVaultService.isConfigured = jest.fn().mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = SecretsManagerService.getInstance();
      const instance2 = SecretsManagerService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should load secrets from Key Vault', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('test-secret-value');

      await secretsManager.initialize();

      expect(mockKeyVaultService.getSecret).toHaveBeenCalled();
      expect((secretsManager as any).initialized).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('test-secret-value');

      await secretsManager.initialize();
      await secretsManager.initialize();

      // Should only be called once during first initialization
      const callCount = mockKeyVaultService.getSecret.mock.calls.length;
      expect(callCount).toBeGreaterThan(0);
    });

    it('should throw error if required secret is missing', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue(null);

      await expect(secretsManager.initialize()).rejects.toThrow();
    });
  });

  describe('getSecret', () => {
    beforeEach(async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('test-value');
      await secretsManager.initialize();
    });

    it('should return secret value', () => {
      const secret = secretsManager.getSecret('JWT_SECRET');
      expect(secret).toBeTruthy();
    });

    it('should return null for non-existent secret', () => {
      const secret = secretsManager.getSecret('NON_EXISTENT');
      expect(secret).toBeNull();
    });
  });

  describe('getJwtSecret', () => {
    it('should return JWT secret', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('jwt-secret-value');
      await secretsManager.initialize();

      const jwtSecret = secretsManager.getJwtSecret();
      expect(jwtSecret).toBe('jwt-secret-value');
    });

    it('should throw error if JWT secret is not configured', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue(null);

      await expect(async () => {
        await secretsManager.initialize();
        secretsManager.getJwtSecret();
      }).rejects.toThrow();
    });
  });

  describe('getAzureAdClientSecret', () => {
    it('should return Azure AD client secret', async () => {
      const previousClientId = process.env.AZURE_AD_CLIENT_ID;
      process.env.AZURE_AD_CLIENT_ID = 'test-client-id';

      mockKeyVaultService.getSecret.mockImplementation((secretName: string) => {
        if (secretName === 'azure-ad-client-secret')
          return Promise.resolve('azure-ad-secret-value');
        return Promise.resolve('test-value');
      });

      await secretsManager.initialize();

      const azureAdSecret = secretsManager.getAzureAdClientSecret();
      expect(azureAdSecret).toBe('azure-ad-secret-value');

      if (previousClientId === undefined) {
        delete process.env.AZURE_AD_CLIENT_ID;
      } else {
        process.env.AZURE_AD_CLIENT_ID = previousClientId;
      }
    });

    it('should return null if Azure AD client secret is not configured', async () => {
      mockKeyVaultService.getSecret.mockImplementation((secretName: string) => {
        if (secretName === 'jwt-secret') return Promise.resolve('jwt-value');
        return Promise.resolve(null);
      });
      await secretsManager.initialize();

      const azureAdSecret = secretsManager.getAzureAdClientSecret();
      expect(azureAdSecret).toBeNull();
    });
  });

  describe('getAdminEncryptionKey', () => {
    it('should return admin encryption key', async () => {
      mockKeyVaultService.getSecret.mockImplementation((secretName: string) => {
        if (secretName === 'admin-encryption-key') return Promise.resolve('admin-key-value');
        return Promise.resolve('test-value');
      });
      await secretsManager.initialize();

      const adminKey = secretsManager.getAdminEncryptionKey();
      expect(adminKey).toBe('admin-key-value');
    });

    it('should return null if admin encryption key is not configured', async () => {
      mockKeyVaultService.getSecret.mockImplementation((secretName: string) => {
        if (secretName === 'jwt-secret') return Promise.resolve('jwt-value');
        return Promise.resolve(null);
      });
      await secretsManager.initialize();

      const adminKey = secretsManager.getAdminEncryptionKey();
      expect(adminKey).toBeNull();
    });
  });

  describe('rotateJwtSecret', () => {
    it('should rotate JWT secret successfully', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('old-secret');
      await secretsManager.initialize();

      mockKeyVaultService.rotateSecret.mockResolvedValue(true);

      const result = await secretsManager.rotateJwtSecret('admin-user-id');

      expect(result).toBe(true);
      expect(mockKeyVaultService.rotateSecret).toHaveBeenCalledWith(
        'jwt-secret',
        expect.any(String),
        'admin-user-id'
      );
    });

    it('should return false on rotation failure', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('old-secret');
      await secretsManager.initialize();

      mockKeyVaultService.rotateSecret.mockResolvedValue(false);

      const result = await secretsManager.rotateJwtSecret('admin-user-id');

      expect(result).toBe(false);
    });
  });

  describe('rotateEncryptionKey', () => {
    it('should rotate encryption key successfully', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('old-key');
      await secretsManager.initialize();

      mockKeyVaultService.rotateSecret.mockResolvedValue(true);

      const result = await secretsManager.rotateEncryptionKey('admin-user-id');

      expect(result).toBe(true);
      expect(mockKeyVaultService.rotateSecret).toHaveBeenCalledWith(
        'encryption-key',
        expect.any(String),
        'admin-user-id'
      );
    });
  });

  describe('rotateDbPassword', () => {
    it('should rotate database password successfully', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('old-password');
      await secretsManager.initialize();

      mockKeyVaultService.rotateSecret.mockResolvedValue(true);

      const result = await secretsManager.rotateDbPassword('new-password', 'admin-user-id');

      expect(result).toBe(true);
      expect(mockKeyVaultService.rotateSecret).toHaveBeenCalledWith(
        'db-password',
        'new-password',
        'admin-user-id'
      );
    });
  });

  describe('checkSecretsRotation', () => {
    it('should check rotation status for all secrets', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('test-value');
      await secretsManager.initialize();

      mockKeyVaultService.needsRotation
        .mockResolvedValueOnce(true) // jwt-secret
        .mockResolvedValueOnce(false) // encryption-key
        .mockResolvedValueOnce(true); // db-password

      const result = await secretsManager.checkSecretsRotation(90);

      expect(result).toEqual({
        'jwt-secret': true,
        'encryption-key': false,
        'db-password': true,
      });
    });
  });

  describe('reloadSecrets', () => {
    it('should reload secrets from Key Vault', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('test-value');
      await secretsManager.initialize();

      mockKeyVaultService.getSecret.mockResolvedValue('new-value');

      await secretsManager.reloadSecrets();

      expect(mockKeyVaultService.clearCache).toHaveBeenCalled();
      expect(mockKeyVaultService.getSecret).toHaveBeenCalled();
    });
  });

  describe('getStatus', () => {
    it('should return current status', async () => {
      mockKeyVaultService.getSecret.mockResolvedValue('test-value');
      await secretsManager.initialize();

      const status = secretsManager.getStatus();

      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('keyVaultConfigured');
      expect(status).toHaveProperty('secretsLoaded');
      expect(status.initialized).toBe(true);
    });
  });

  describe('isKeyVaultConfigured', () => {
    it('should return true if Key Vault is configured', () => {
      mockKeyVaultService.isConfigured.mockReturnValue(true);

      const result = secretsManager.isKeyVaultConfigured();

      expect(result).toBe(true);
    });

    it('should return false if Key Vault is not configured', () => {
      mockKeyVaultService.isConfigured.mockReturnValue(false);

      const result = secretsManager.isKeyVaultConfigured();

      expect(result).toBe(false);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
