import { BulkAccountService } from '../../services/user';

jest.mock('../../services/user', () => {
  const actual = jest.requireActual('../../services/user');
  return {
    ...actual,
    SharedAccountService: jest.fn().mockImplementation(() => ({
      createSharedAccount: jest.fn(),
      getSharedAccountsByOrganization: jest.fn(),
    })),
  };
});

describe('BulkAccountService', () => {
  let service: BulkAccountService;
  let mockSharedAccountService: any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BulkAccountService();
    mockSharedAccountService = (service as any).sharedAccountService;

    // Reset mocks to be properly chainable
    mockSharedAccountService.createSharedAccount = jest.fn();
    mockSharedAccountService.getSharedAccountsByOrganization = jest.fn();
  });

  describe('importAccounts', () => {
    it('should import valid accounts successfully', async () => {
      const accounts = [
        {
          accountName: 'Account 1',
          accountUsername: 'user1',
          password: 'pass1',
          description: 'Test account 1',
        },
        {
          accountName: 'Account 2',
          accountUsername: 'user2',
          password: 'pass2',
        },
      ];

      mockSharedAccountService.createSharedAccount.mockResolvedValue({ id: 'acc-1' });

      const result = await service.importAccounts(accounts, 'org-1', 'user-1');

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
      expect(mockSharedAccountService.createSharedAccount).toHaveBeenCalledTimes(2);
    });

    it('should handle accounts with categories and tags', async () => {
      const accounts = [
        {
          accountName: 'Account 1',
          accountUsername: 'user1',
          password: 'pass1',
          categories: ['training', 'ops'],
          tags: ['priority', 'fleet'],
        },
      ];

      mockSharedAccountService.createSharedAccount.mockResolvedValue({ id: 'acc-1' });

      await service.importAccounts(accounts, 'org-1', 'user-1');

      expect(mockSharedAccountService.createSharedAccount).toHaveBeenCalledWith(
        'Account 1',
        'user1',
        'pass1',
        'org-1',
        'user-1',
        undefined,
        undefined,
        ['training', 'ops'],
        ['priority', 'fleet'],
        undefined
      );
    });

    it('should handle invalid accounts and report errors', async () => {
      const accounts = [
        {
          accountName: 'Account 1',
          accountUsername: 'user1',
          password: 'pass1',
        },
        {
          accountName: '', // Invalid
          accountUsername: 'user2',
          password: 'pass2',
        },
        {
          accountName: 'Account 3',
          accountUsername: 'user3',
          password: 'pass3',
        },
      ];

      mockSharedAccountService.createSharedAccount
        .mockResolvedValueOnce({ id: 'acc-1' })
        .mockResolvedValueOnce({ id: 'acc-3' });

      const result = await service.importAccounts(accounts, 'org-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.imported).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row).toBe(2);
    });

    it('should handle creation failures', async () => {
      const accounts = [
        {
          accountName: 'Account 1',
          accountUsername: 'user1',
          password: 'pass1',
        },
      ];

      mockSharedAccountService.createSharedAccount.mockResolvedValue(null);

      const result = await service.importAccounts(accounts, 'org-1', 'user-1');

      expect(result.success).toBe(false);
      expect(result.imported).toBe(0);
      expect(result.failed).toBe(1);
    });
  });

  describe('exportAccounts', () => {
    it('should export accounts to proper format', async () => {
      const mockAccounts = [
        {
          id: 'acc-1',
          accountName: 'Account 1',
          accountUsername: 'user1',
          description: 'Test account',
          categories: ['training'],
          tags: ['priority'],
          passwordExpiresAt: new Date('2025-12-31'),
          createdBy: 'user-1',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          lastAccessedAt: new Date('2024-01-03'),
          organizationId: 'org-1',
          keyVaultSecretName: 'secret-1',
        },
      ];

      mockSharedAccountService.getSharedAccountsByOrganization.mockResolvedValue(mockAccounts);

      const result = await service.exportAccounts('org-1');

      expect(result).toHaveLength(1);
      expect(result[0].accountName).toBe('Account 1');
      expect(result[0].categories).toBe('training');
      expect(result[0].tags).toBe('priority');
      expect(result[0]).not.toHaveProperty('keyVaultSecretName');
    });

    it('should handle empty arrays gracefully', async () => {
      const mockAccount = {
        id: 'acc-1',
        accountName: 'Account 1',
        accountUsername: 'user1',
        categories: undefined,
        tags: undefined,
        createdBy: 'user-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
        organizationId: 'org-1',
        keyVaultSecretName: 'secret-1',
      };

      mockSharedAccountService.getSharedAccountsByOrganization.mockResolvedValue([mockAccount]);

      const result = await service.exportAccounts('org-1');

      expect(result[0].categories).toBe('');
      expect(result[0].tags).toBe('');
    });
  });

  describe('parseCSV', () => {
    it('should parse CSV with headers correctly', () => {
      const csv = `accountName,accountUsername,password,description
Account 1,user1,pass1,Test account
Account 2,user2,pass2,Another test`;

      const result = service.parseCSV(csv);

      expect(result).toHaveLength(2);
      expect(result[0].accountName).toBe('Account 1');
      expect(result[0].accountUsername).toBe('user1');
      expect(result[0].password).toBe('pass1');
      expect(result[1].accountName).toBe('Account 2');
    });

    it('should parse CSV with categories and tags', () => {
      const csv = `accountName,accountUsername,password,categories,tags
Account 1,user1,pass1,training|ops,priority|fleet`;

      const result = service.parseCSV(csv);

      expect(result[0].categories).toEqual(['training', 'ops']);
      expect(result[0].tags).toEqual(['priority', 'fleet']);
    });

    it('should handle empty CSV', () => {
      const csv = '';

      const result = service.parseCSV(csv);

      expect(result).toEqual([]);
    });

    it('should handle CSV with only headers', () => {
      const csv = 'accountName,accountUsername,password';

      const result = service.parseCSV(csv);

      expect(result).toEqual([]);
    });
  });

  describe('toCSV', () => {
    it('should convert accounts to CSV format', () => {
      const accounts = [
        {
          accountName: 'Account 1',
          accountUsername: 'user1',
          description: 'Test',
          categories: 'training',
          tags: 'priority',
          passwordExpiresAt: '2025-12-31T00:00:00.000Z',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          lastAccessedAt: '2024-01-03T00:00:00.000Z',
        },
      ];

      const result = service.toCSV(accounts);

      expect(result).toContain('accountName,accountUsername');
      expect(result).toContain('Account 1,user1');
    });

    it('should handle values with commas', () => {
      const accounts = [
        {
          accountName: 'Account 1',
          accountUsername: 'user1',
          description: 'Test, with comma',
          categories: '',
          tags: '',
          passwordExpiresAt: '',
          createdBy: 'user-1',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
          lastAccessedAt: '',
        },
      ];

      const result = service.toCSV(accounts);

      expect(result).toContain('"Test, with comma"');
    });

    it('should handle empty array', () => {
      const result = service.toCSV([]);

      expect(result).toBe('');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
