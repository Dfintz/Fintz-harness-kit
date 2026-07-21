import { KeyVaultService } from '../../services/cloud/KeyVaultService';

describe('KeyVaultService', () => {
  let keyVaultService: KeyVaultService;
  const instances: KeyVaultService[] = [];

  beforeEach(() => {
    // Clear environment variables before each test
    delete process.env.AZURE_KEY_VAULT_NAME;
    keyVaultService = new KeyVaultService();
    instances.push(keyVaultService);
  });

  afterEach(() => {
    // Stop cleanup intervals after each test
    instances.forEach(instance => instance.stopCleanup());
    instances.length = 0;
  });

  afterAll(() => {
    // Final cleanup
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('should return false when Key Vault is not configured', () => {
      const isConfigured = keyVaultService.isConfigured();
      expect(isConfigured).toBe(false);
    });

    it('should return true when Key Vault name is set', () => {
      // When AZURE_KEY_VAULT_NAME is set, service considers itself configured
      process.env.AZURE_KEY_VAULT_NAME = 'test-keyvault';
      const service = new KeyVaultService();
      instances.push(service); // Track for cleanup
      const isConfigured = service.isConfigured();

      expect(isConfigured).toBe(true);
    });
  });

  describe('getSecret', () => {
    it('should return null when Key Vault is not configured and no env var fallback', async () => {
      const secret = await keyVaultService.getSecret('test-secret');
      expect(secret).toBeNull();
    });

    it('should fall back to environment variable when Key Vault is not configured', async () => {
      process.env.TEST_SECRET = 'test-value';
      const secret = await keyVaultService.getSecret('test-secret', 'TEST_SECRET');
      expect(secret).toBe('test-value');
      delete process.env.TEST_SECRET;
    });

    it('should return null when neither Key Vault nor env var is available', async () => {
      const secret = await keyVaultService.getSecret('test-secret', 'NON_EXISTENT_VAR');
      expect(secret).toBeNull();
    });
  });

  describe('getSecrets', () => {
    it('should retrieve multiple secrets', async () => {
      process.env.SECRET_1 = 'value1';
      process.env.SECRET_2 = 'value2';

      const secrets = await keyVaultService.getSecrets([
        { secretName: 'secret-1', envVarName: 'SECRET_1' },
        { secretName: 'secret-2', envVarName: 'SECRET_2' },
        { secretName: 'secret-3', envVarName: 'NON_EXISTENT' },
      ]);

      expect(secrets['secret-1']).toBe('value1');
      expect(secrets['secret-2']).toBe('value2');
      expect(secrets['secret-3']).toBeNull();

      delete process.env.SECRET_1;
      delete process.env.SECRET_2;
    });
  });

  describe('setSecret', () => {
    it('should return false when Key Vault is not configured', async () => {
      const result = await keyVaultService.setSecret('test-secret', 'test-value');
      expect(result).toBe(false);
    });
  });

  describe('deleteSecret', () => {
    it('should return false when Key Vault is not configured', async () => {
      const result = await keyVaultService.deleteSecret('test-secret');
      expect(result).toBe(false);
    });
  });
});
