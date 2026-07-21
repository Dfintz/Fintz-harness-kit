/**
 * GdprDataDeletionService — Discord preferences cascade tests (PR 2)
 *
 * Verifies that DiscordUserPreference rows for the user are removed during
 * GDPR Article 17 cascade deletion and counted in the deletion preview.
 */

import { mockAppDataSource } from '../../../__tests__/helpers/database-mock';

jest.mock('../../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { DiscordUserPreference } from '../../../models/DiscordUserPreference';
import { GdprDataDeletionService } from '../GdprDataDeletionService';

describe('GdprDataDeletionService — Discord preferences cascade', () => {
  let service: GdprDataDeletionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GdprDataDeletionService();
    // Bypass legal hold lookups
    jest
      .spyOn(service, 'checkLegalHold')
      .mockResolvedValue({ isOnHold: false });
  });

  describe('deleteAllUserData', () => {
    it('invokes deleteFromTable for DiscordUserPreference with the user id', async () => {
      const deleteSpy = jest
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .spyOn(service as any, 'deleteFromTable')
        .mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, 'deleteFromTableNumericId').mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, 'deleteFromTableByRater').mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, 'anonymizeActivities').mockResolvedValue(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.spyOn(service as any, 'anonymizeIntelAuditLogs').mockResolvedValue(0);

      await service.deleteAllUserData('user-discord-prefs');

      const calledWithDiscordPref = deleteSpy.mock.calls.some(
        ([, entity]) => entity === DiscordUserPreference
      );
      expect(calledWithDiscordPref).toBe(true);

      const discordCall = deleteSpy.mock.calls.find(
        ([, entity]) => entity === DiscordUserPreference
      );
      expect(discordCall?.[2]).toBe('userId');
      expect(discordCall?.[3]).toBe('user-discord-prefs');
    });
  });

  describe('getDataDeletionPreview', () => {
    it('includes discordPreferences count from DiscordUserPreference repository', async () => {
      const countMock = jest.fn().mockResolvedValue(0);
      const discordCount = jest.fn().mockResolvedValue(7);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const getRepoSpy = jest.spyOn(mockAppDataSource as any, 'getRepository');
      getRepoSpy.mockImplementation((entity: unknown) => {
        if (entity === DiscordUserPreference) {
          return { count: discordCount } as never;
        }
        return { count: countMock } as never;
      });

      const preview = await service.getDataDeletionPreview('user-1');

      expect(discordCount).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
      expect(preview.discordPreferences).toBe(7);

      getRepoSpy.mockRestore();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

