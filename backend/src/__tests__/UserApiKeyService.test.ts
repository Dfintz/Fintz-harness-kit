import crypto from 'node:crypto';
import { UserApiKey } from '../models/UserApiKey';
import { UserApiKeyService } from '../services/security/UserApiKeyService';
import { ConflictError, NotFoundError, ValidationError } from '../utils/apiErrors';

const mockRepo = {
  count: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
};

jest.mock('../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockRepo),
  },
}));

describe('UserApiKeyService', () => {
  let service: UserApiKeyService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserApiKeyService();
  });

  describe('createKey', () => {
    it('should create a key and return the raw token', async () => {
      mockRepo.count.mockResolvedValue(0);
      mockRepo.findOne.mockResolvedValue(null); // no duplicate name
      mockRepo.create.mockImplementation((data: Partial<UserApiKey>) => ({
        ...data,
        id: 'key-1',
        createdAt: new Date(),
      }));
      mockRepo.save.mockImplementation((data: Partial<UserApiKey>) => ({
        ...data,
        id: 'key-1',
        createdAt: new Date(),
      }));

      const result = await service.createKey('user-1', {
        name: 'Wingman AI',
        scopes: ['read:activities', 'write:activities'],
      });

      expect(result.rawKey).toMatch(/^fc_[a-f0-9]{40}$/);
      expect(result.name).toBe('Wingman AI');
      expect(result.scopes).toEqual(['read:activities', 'write:activities']);
      expect(result.prefix).toHaveLength(12);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          name: 'Wingman AI',
          scopes: ['read:activities', 'write:activities'],
        })
      );
    });

    it('should throw ValidationError for invalid scope', async () => {
      await expect(
        service.createKey('user-1', { name: 'Test', scopes: ['invalid_scope'] })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ConflictError when key limit reached', async () => {
      mockRepo.count.mockResolvedValue(10);

      await expect(
        service.createKey('user-1', { name: 'Test', scopes: ['read:activities'] })
      ).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError for duplicate name', async () => {
      mockRepo.count.mockResolvedValue(0);
      mockRepo.findOne.mockResolvedValue({ id: 'existing' }); // duplicate name

      await expect(
        service.createKey('user-1', { name: 'Duplicate', scopes: ['read:activities'] })
      ).rejects.toThrow(ConflictError);
    });

    it('should set expiresAt when expiresInDays provided', async () => {
      mockRepo.count.mockResolvedValue(0);
      mockRepo.findOne.mockResolvedValue(null);
      mockRepo.create.mockImplementation((data: Partial<UserApiKey>) => ({
        ...data,
        id: 'key-1',
        createdAt: new Date(),
      }));
      mockRepo.save.mockImplementation((data: Partial<UserApiKey>) => ({
        ...data,
        id: 'key-1',
        createdAt: new Date(),
      }));

      const result = await service.createKey('user-1', {
        name: 'Expiring Key',
        scopes: ['read:activities'],
        expiresInDays: 30,
      });

      expect(result.expiresAt).toBeDefined();
    });
  });

  describe('listKeys', () => {
    it('should return keys without tokenHash', async () => {
      mockRepo.find.mockResolvedValue([
        { id: 'key-1', name: 'Test', prefix: 'fc_abc123', scopes: ['read:activities'] },
      ]);

      const keys = await service.listKeys('user-1');

      expect(keys).toHaveLength(1);
      expect(mockRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          select: expect.not.arrayContaining(['tokenHash']),
        })
      );
    });
  });

  describe('revokeKey', () => {
    it('should revoke an active key', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        revoked: false,
      });
      mockRepo.save.mockImplementation((data: unknown) => data);

      await service.revokeKey('user-1', 'key-1');

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ revoked: true })
      );
    });

    it('should throw NotFoundError for non-existent key', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.revokeKey('user-1', 'key-999')).rejects.toThrow(NotFoundError);
    });

    it('should throw ValidationError for already revoked key', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'key-1', revoked: true });

      await expect(service.revokeKey('user-1', 'key-1')).rejects.toThrow(ValidationError);
    });
  });

  describe('validateKey', () => {
    it('should validate a correct raw key', async () => {
      const rawKey = 'fc_' + crypto.randomBytes(20).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawKey).digest('hex');

      mockRepo.findOne.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        tokenHash,
        scopes: ['read:activities'],
        revoked: false,
        expiresAt: null,
        isValid: () => true,
        hasScope: (s: string) => s === 'read:activities',
      });
      mockRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.validateKey(rawKey, 'read:activities');

      expect(result).not.toBeNull();
      expect(result?.userId).toBe('user-1');
      expect(result?.scopes).toEqual(['read:activities']);
    });

    it('should return null for invalid key', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.validateKey('fc_invalid');

      expect(result).toBeNull();
    });

    it('should return null for revoked key', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'key-1',
        revoked: true,
        isValid: () => false,
      });

      const result = await service.validateKey('fc_something');

      expect(result).toBeNull();
    });
  });

  describe('updateKey', () => {
    it('should update key name and scopes', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'key-1',
        userId: 'user-1',
        name: 'Old Name',
        scopes: ['read:activities'],
        revoked: false,
      });
      mockRepo.save.mockImplementation((data: unknown) => data);

      const result = await service.updateKey('user-1', 'key-1', {
        name: 'New Name',
        scopes: ['read:activities', 'read:fleet'],
      });

      expect(result.name).toBe('New Name');
      expect(result.scopes).toEqual(['read:activities', 'read:fleet']);
    });

    it('should throw ValidationError for revoked key', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'key-1',
        revoked: true,
      });

      await expect(
        service.updateKey('user-1', 'key-1', { name: 'Test' })
      ).rejects.toThrow(ValidationError);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
