import { AppDataSource } from '../../config/database';
import { SharedAccount } from '../../models/SharedAccount';
import { KeyVaultService } from '../../services/cloud/KeyVaultService';
import { SharedAccountService } from '../../services/user';

jest.mock('../../services/cloud/KeyVaultService', () => ({
  KeyVaultService: jest.fn().mockImplementation(() => ({
    setSecret: jest.fn(),
    getSecret: jest.fn(),
    deleteSecret: jest.fn(),
  })),
}));
jest.mock('../../config/database');

describe('SharedAccountService', () => {
  let sharedAccountService: SharedAccountService;
  let mockKeyVaultService: jest.Mocked<KeyVaultService>;
  let mockRepository: any;

  beforeEach(() => {
    // Setup mock repository
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    // Setup mock KeyVaultService
    mockKeyVaultService = new KeyVaultService() as jest.Mocked<KeyVaultService>;
    mockKeyVaultService.setSecret = jest.fn();
    mockKeyVaultService.getSecret = jest.fn();
    mockKeyVaultService.deleteSecret = jest.fn();

    sharedAccountService = new SharedAccountService();
    (sharedAccountService as any).keyVaultService = mockKeyVaultService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSharedAccount', () => {
    it('should create a shared account and store password in Key Vault', async () => {
      const accountData = {
        accountName: 'Test Account',
        accountUsername: 'testuser',
        password: 'testpass123',
        organizationId: 'org-123',
        createdBy: 'user-123',
        description: 'Test description',
      };

      const mockAccount: Partial<SharedAccount> = {
        id: 'account-123',
        accountName: accountData.accountName,
        accountUsername: accountData.accountUsername,
        organizationId: accountData.organizationId,
        createdBy: accountData.createdBy,
        keyVaultSecretName: expect.any(String),
      };

      mockKeyVaultService.setSecret.mockResolvedValue(true);
      mockRepository.create.mockReturnValue(mockAccount);
      mockRepository.save.mockResolvedValue(mockAccount);

      const result = await sharedAccountService.createSharedAccount(
        accountData.accountName,
        accountData.accountUsername,
        accountData.password,
        accountData.organizationId,
        accountData.createdBy,
        accountData.description
      );

      expect(mockKeyVaultService.setSecret).toHaveBeenCalled();
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toBeTruthy();
      expect(result?.accountName).toBe(accountData.accountName);
    });

    it('should return null if Key Vault storage fails', async () => {
      mockKeyVaultService.setSecret.mockResolvedValue(false);

      const result = await sharedAccountService.createSharedAccount(
        'Test Account',
        'testuser',
        'testpass123',
        'org-123',
        'user-123'
      );

      expect(result).toBeNull();
      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('getSharedAccountsByOrganization', () => {
    it('should return all shared accounts for an organization', async () => {
      const mockAccounts = [
        { id: '1', accountName: 'Account 1', organizationId: 'org-123' },
        { id: '2', accountName: 'Account 2', organizationId: 'org-123' },
      ];

      mockRepository.find.mockResolvedValue(mockAccounts);

      const result = await sharedAccountService.getSharedAccountsByOrganization('org-123');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { organizationId: 'org-123' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(mockAccounts);
    });
  });

  describe('getSharedAccountPassword', () => {
    it('should retrieve password from Key Vault', async () => {
      const mockAccount: Partial<SharedAccount> = {
        id: 'account-123',
        keyVaultSecretName: 'secret-name',
      };

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockKeyVaultService.getSecret.mockResolvedValue('password123');

      const result = await sharedAccountService.getSharedAccountPassword('account-123');

      expect(mockKeyVaultService.getSecret).toHaveBeenCalledWith('secret-name');
      expect(result).toBe('password123');
    });

    it('should return null if account not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await sharedAccountService.getSharedAccountPassword('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateSharedAccountPassword', () => {
    it('should update password in Key Vault', async () => {
      const mockAccount: Partial<SharedAccount> = {
        id: 'account-123',
        keyVaultSecretName: 'secret-name',
      };

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockKeyVaultService.setSecret.mockResolvedValue(true);

      const result = await sharedAccountService.updateSharedAccountPassword(
        'account-123',
        'newpassword123'
      );

      expect(mockKeyVaultService.setSecret).toHaveBeenCalledWith('secret-name', 'newpassword123');
      expect(result).toBe(true);
    });
  });

  describe('deleteSharedAccount', () => {
    it('should delete account and remove from Key Vault', async () => {
      const mockAccount: Partial<SharedAccount> = {
        id: 'account-123',
        keyVaultSecretName: 'secret-name',
      };

      mockRepository.findOne.mockResolvedValue(mockAccount);
      mockKeyVaultService.deleteSecret.mockResolvedValue(true);
      mockRepository.remove.mockResolvedValue(mockAccount);

      const result = await sharedAccountService.deleteSharedAccount('account-123');

      expect(mockKeyVaultService.deleteSecret).toHaveBeenCalledWith('secret-name');
      expect(mockRepository.remove).toHaveBeenCalledWith(mockAccount);
      expect(result).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
