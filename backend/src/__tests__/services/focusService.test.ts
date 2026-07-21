import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { OrgFocusPreference } from '../../models/OrgFocusPreference';
import { UserFocusPreference } from '../../models/UserFocusPreference';
import { FocusService, FocusValue } from '../../services/user/FocusService';
import { ValidationError } from '../../utils/apiErrors';

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('FocusService', () => {
  let service: FocusService;
  let mockUserRepo: jest.Mocked<
    Pick<Repository<UserFocusPreference>, 'findOneBy' | 'create' | 'save'>
  >;
  let mockOrgRepo: jest.Mocked<
    Pick<Repository<OrgFocusPreference>, 'findOneBy' | 'create' | 'save'>
  >;

  beforeEach(() => {
    mockUserRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn(entity => entity as UserFocusPreference),
      save: jest.fn(entity => Promise.resolve(entity as UserFocusPreference)),
    };

    mockOrgRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      create: jest.fn(entity => entity as OrgFocusPreference),
      save: jest.fn(entity => Promise.resolve(entity as OrgFocusPreference)),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity === UserFocusPreference) return mockUserRepo;
      if (entity === OrgFocusPreference) return mockOrgRepo;
      return {};
    });

    service = new FocusService();
  });

  describe('getFocusList', () => {
    it('should return complete list of focus values', () => {
      const list = service.getFocusList();

      expect(list).toHaveLength(12);
      expect(list).toContain('Bounty Hunting');
      expect(list).toContain('Engineering');
      expect(list).toContain('Exploration');
      expect(list).toContain('Medical');
      expect(list).toContain('Piracy');
      expect(list).toContain('Infiltration');
      expect(list).toContain('Resources');
      expect(list).toContain('Scouting');
      expect(list).toContain('Security');
      expect(list).toContain('Smuggling');
      expect(list).toContain('Trading');
      expect(list).toContain('Transport');
    });

    it('should return the same list on multiple calls', () => {
      const list1 = service.getFocusList();
      const list2 = service.getFocusList();

      expect(list1).toEqual(list2);
    });
  });

  describe('setUserFocus', () => {
    it('should set user focus with valid limits', async () => {
      const primary: FocusValue[] = ['Bounty Hunting', 'Trading'];
      const secondary: FocusValue[] = ['Exploration'];

      await service.setUserFocus('user-1', primary, secondary);

      expect(mockUserRepo.findOneBy).toHaveBeenCalledWith({ userId: 'user-1' });
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        primaryFocuses: primary,
        secondaryFocuses: secondary,
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should allow maximum of 3 primary focuses', async () => {
      const primary: FocusValue[] = ['Bounty Hunting', 'Trading', 'Exploration'];
      const secondary: FocusValue[] = [];

      await expect(service.setUserFocus('user-1', primary, secondary)).resolves.not.toThrow();
    });

    it('should allow maximum of 3 secondary focuses', async () => {
      const primary: FocusValue[] = [];
      const secondary: FocusValue[] = ['Medical', 'Engineering', 'Scouting'];

      await expect(service.setUserFocus('user-1', primary, secondary)).resolves.not.toThrow();
    });

    it('should throw error when exceeding primary focus limit', async () => {
      const primary: FocusValue[] = ['Bounty Hunting', 'Trading', 'Exploration', 'Medical'];
      const secondary: FocusValue[] = [];

      await expect(service.setUserFocus('user-1', primary, secondary)).rejects.toThrow(
        'Users can set up to 3 primary and 3 secondary focuses.'
      );

      const error = await service
        .setUserFocus('user-1', primary, secondary)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should throw error when exceeding secondary focus limit', async () => {
      const primary: FocusValue[] = [];
      const secondary: FocusValue[] = ['Medical', 'Engineering', 'Scouting', 'Security'];

      await expect(service.setUserFocus('user-1', primary, secondary)).rejects.toThrow(
        'Users can set up to 3 primary and 3 secondary focuses.'
      );

      const error = await service
        .setUserFocus('user-1', primary, secondary)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should allow empty arrays', async () => {
      await service.setUserFocus('user-1', [], []);

      expect(mockUserRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        primaryFocuses: [],
        secondaryFocuses: [],
      });
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should update existing user focus', async () => {
      const existingRecord = {
        id: 'rec-1',
        userId: 'user-1',
        primaryFocuses: ['Trading'],
        secondaryFocuses: ['Medical'],
      } as UserFocusPreference;

      mockUserRepo.findOneBy.mockResolvedValue(existingRecord);

      await service.setUserFocus('user-1', ['Bounty Hunting'], ['Engineering']);

      expect(existingRecord.primaryFocuses).toEqual(['Bounty Hunting']);
      expect(existingRecord.secondaryFocuses).toEqual(['Engineering']);
      expect(mockUserRepo.save).toHaveBeenCalledWith(existingRecord);
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('setOrgFocus', () => {
    it('should set organization focus with valid limit', async () => {
      const focuses: FocusValue[] = ['Trading', 'Transport'];

      await service.setOrgFocus('org-1', focuses);

      expect(mockOrgRepo.findOneBy).toHaveBeenCalledWith({ orgId: 'org-1' });
      expect(mockOrgRepo.create).toHaveBeenCalledWith({
        orgId: 'org-1',
        focuses,
      });
      expect(mockOrgRepo.save).toHaveBeenCalled();
    });

    it('should allow maximum of 2 focuses', async () => {
      const focuses: FocusValue[] = ['Trading', 'Exploration'];

      await expect(service.setOrgFocus('org-1', focuses)).resolves.not.toThrow();
    });

    it('should throw error when exceeding focus limit', async () => {
      const focuses: FocusValue[] = ['Trading', 'Exploration', 'Medical'];

      await expect(service.setOrgFocus('org-1', focuses)).rejects.toThrow(
        'Organizations can set up to 2 focuses.'
      );

      const error = await service.setOrgFocus('org-1', focuses).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('should allow single focus', async () => {
      await service.setOrgFocus('org-1', ['Bounty Hunting']);

      expect(mockOrgRepo.create).toHaveBeenCalledWith({
        orgId: 'org-1',
        focuses: ['Bounty Hunting'],
      });
      expect(mockOrgRepo.save).toHaveBeenCalled();
    });

    it('should allow empty array', async () => {
      await service.setOrgFocus('org-1', []);

      expect(mockOrgRepo.create).toHaveBeenCalledWith({
        orgId: 'org-1',
        focuses: [],
      });
      expect(mockOrgRepo.save).toHaveBeenCalled();
    });

    it('should update existing organization focus', async () => {
      const existingRecord = {
        id: 'rec-1',
        orgId: 'org-1',
        focuses: ['Trading'],
      } as OrgFocusPreference;

      mockOrgRepo.findOneBy.mockResolvedValue(existingRecord);

      await service.setOrgFocus('org-1', ['Bounty Hunting', 'Exploration']);

      expect(existingRecord.focuses).toEqual(['Bounty Hunting', 'Exploration']);
      expect(mockOrgRepo.save).toHaveBeenCalledWith(existingRecord);
      expect(mockOrgRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getUserFocus', () => {
    it('should return user focus when set', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({
        userId: 'user-1',
        primaryFocuses: ['Trading'],
        secondaryFocuses: ['Medical'],
      } as UserFocusPreference);

      const focus = await service.getUserFocus('user-1');

      expect(focus).toBeDefined();
      expect(focus?.userId).toBe('user-1');
      expect(focus?.primaryFocuses).toEqual(['Trading']);
      expect(focus?.secondaryFocuses).toEqual(['Medical']);
    });

    it('should return undefined for non-existent user', async () => {
      mockUserRepo.findOneBy.mockResolvedValue(null);

      const focus = await service.getUserFocus('user-999');

      expect(focus).toBeUndefined();
    });

    it('should handle multiple users independently', async () => {
      mockUserRepo.findOneBy
        .mockResolvedValueOnce({
          userId: 'user-1',
          primaryFocuses: ['Trading'],
          secondaryFocuses: [],
        } as UserFocusPreference)
        .mockResolvedValueOnce({
          userId: 'user-2',
          primaryFocuses: ['Bounty Hunting'],
          secondaryFocuses: [],
        } as UserFocusPreference);

      const focus1 = await service.getUserFocus('user-1');
      const focus2 = await service.getUserFocus('user-2');

      expect(focus1?.primaryFocuses).toEqual(['Trading']);
      expect(focus2?.primaryFocuses).toEqual(['Bounty Hunting']);
    });
  });

  describe('getOrgFocus', () => {
    it('should return organization focus when set', async () => {
      mockOrgRepo.findOneBy.mockResolvedValue({
        orgId: 'org-1',
        focuses: ['Trading', 'Transport'],
      } as OrgFocusPreference);

      const focus = await service.getOrgFocus('org-1');

      expect(focus).toBeDefined();
      expect(focus?.orgId).toBe('org-1');
      expect(focus?.focuses).toEqual(['Trading', 'Transport']);
    });

    it('should return undefined for non-existent organization', async () => {
      mockOrgRepo.findOneBy.mockResolvedValue(null);

      const focus = await service.getOrgFocus('org-999');

      expect(focus).toBeUndefined();
    });

    it('should handle multiple organizations independently', async () => {
      mockOrgRepo.findOneBy
        .mockResolvedValueOnce({
          orgId: 'org-1',
          focuses: ['Trading'],
        } as OrgFocusPreference)
        .mockResolvedValueOnce({
          orgId: 'org-2',
          focuses: ['Bounty Hunting'],
        } as OrgFocusPreference);

      const focus1 = await service.getOrgFocus('org-1');
      const focus2 = await service.getOrgFocus('org-2');

      expect(focus1?.focuses).toEqual(['Trading']);
      expect(focus2?.focuses).toEqual(['Bounty Hunting']);
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed user and org operations', async () => {
      mockUserRepo.findOneBy.mockResolvedValue({
        userId: 'user-1',
        primaryFocuses: ['Trading'],
        secondaryFocuses: ['Medical'],
      } as UserFocusPreference);

      mockOrgRepo.findOneBy.mockResolvedValue({
        orgId: 'org-1',
        focuses: ['Trading', 'Transport'],
      } as OrgFocusPreference);

      const userFocus = await service.getUserFocus('user-1');
      const orgFocus = await service.getOrgFocus('org-1');

      expect(userFocus?.primaryFocuses).toEqual(['Trading']);
      expect(orgFocus?.focuses).toEqual(['Trading', 'Transport']);
    });

    it('should maintain separate state for users and organizations', async () => {
      mockUserRepo.findOneBy.mockImplementation(async where => {
        if ((where as { userId: string }).userId === 'user-1') {
          return {
            userId: 'user-1',
            primaryFocuses: ['Trading'],
            secondaryFocuses: [],
          } as UserFocusPreference;
        }
        return null;
      });

      mockOrgRepo.findOneBy.mockImplementation(async where => {
        if ((where as { orgId: string }).orgId === 'org-1') {
          return { orgId: 'org-1', focuses: ['Bounty Hunting'] } as OrgFocusPreference;
        }
        return null;
      });

      // Verify they don't interfere
      expect(await service.getUserFocus('user-1')).toBeDefined();
      expect(await service.getOrgFocus('org-1')).toBeDefined();
      expect(await service.getUserFocus('org-1')).toBeUndefined();
      expect(await service.getOrgFocus('user-1')).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
