/**
 * BackupService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - missing backup (delete / restore)       → NotFoundError (statusCode 404)
 * - restoring a non-completed backup         → ConflictError (statusCode 409)
 * - download when blob storage unconfigured  → ServiceUnavailableError (503)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response. The ConflictError (409) and ServiceUnavailableError
 * (503) paths previously threw a bare Error that fell through to 500, so these
 * guard the 500→409 / 500→503 fixes.
 */
import { Backup, BackupStatus } from '../../../models/Backup';
import { BackupSchedule } from '../../../models/BackupSchedule';
import { ConflictError, NotFoundError, ServiceUnavailableError } from '../../../utils/apiErrors';

const mockBackupRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  softRemove: jest.fn(),
  // TenantService base reads repository.metadata.name in its constructor
  metadata: { name: 'Backup', primaryColumns: [{ propertyName: 'id' }] },
};
const mockScheduleRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };

const mockBackupStorage = {
  isConfigured: jest.fn(),
  generateDownloadUrl: jest.fn(),
  deleteBackup: jest.fn(),
};

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Backup) return mockBackupRepo;
      if (entity === BackupSchedule) return mockScheduleRepo;
      return {};
    }),
  },
}));

jest.mock('../../../services/cloud/BackupStorageService', () => ({
  getBackupStorageService: jest.fn(() => mockBackupStorage),
}));

jest.mock('../../../websocket/websocketServer', () => ({ emitToOrganization: jest.fn() }));
jest.mock('../../../utils/auditLogger', () => ({ logAuditEvent: jest.fn(), AuditEventType: {} }));

// Import after mocks
import { BackupService } from '../../../services/backup/BackupService';

describe('BackupService — typed error contract', () => {
  let service: BackupService;

  const orgId = 'org-1';
  const userId = 'user-1';
  const userName = 'Admin';
  const backupId = 'backup-1';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BackupService();
  });

  describe('getDownloadUrl', () => {
    it('returns null when the backup has no blob (nothing to download)', async () => {
      mockBackupRepo.findOne.mockResolvedValue({ id: backupId, blobName: null });

      await expect(service.getDownloadUrl(orgId, backupId)).resolves.toBeNull();
      expect(mockBackupStorage.generateDownloadUrl).not.toHaveBeenCalled();
    });

    it('throws ServiceUnavailableError (503) when blob storage is not configured', async () => {
      mockBackupRepo.findOne.mockResolvedValue({ id: backupId, blobName: 'blob.json' });
      mockBackupStorage.isConfigured.mockReturnValue(false);

      await expect(service.getDownloadUrl(orgId, backupId)).rejects.toMatchObject({
        name: 'ServiceUnavailableError',
        statusCode: 503,
      });
      await expect(service.getDownloadUrl(orgId, backupId)).rejects.toBeInstanceOf(
        ServiceUnavailableError
      );
    });

    it('returns a signed URL when blob storage is configured', async () => {
      mockBackupRepo.findOne.mockResolvedValue({ id: backupId, blobName: 'blob.json' });
      mockBackupStorage.isConfigured.mockReturnValue(true);
      mockBackupStorage.generateDownloadUrl.mockResolvedValue('https://signed.example/blob.json');

      await expect(service.getDownloadUrl(orgId, backupId)).resolves.toBe(
        'https://signed.example/blob.json'
      );
    });
  });

  describe('deleteBackup', () => {
    it('throws NotFoundError (404) when the backup does not exist', async () => {
      mockBackupRepo.findOne.mockResolvedValue(null);

      await expect(service.deleteBackup(orgId, backupId, userId, userName)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Backup not found',
      });
    });
  });

  describe('restoreFromBackup', () => {
    it('throws NotFoundError (404) when the backup does not exist', async () => {
      mockBackupRepo.findOne.mockResolvedValue(null);

      await expect(
        service.restoreFromBackup(orgId, backupId, userId, userName)
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it('throws ConflictError (409) when the backup is not completed', async () => {
      mockBackupRepo.findOne.mockResolvedValue({
        id: backupId,
        name: 'Nightly',
        status: BackupStatus.PENDING,
      });

      await expect(
        service.restoreFromBackup(orgId, backupId, userId, userName)
      ).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
        message: 'Only completed backups can be restored',
      });
      await expect(
        service.restoreFromBackup(orgId, backupId, userId, userName)
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('queues the restore when the backup is completed', async () => {
      mockBackupRepo.findOne.mockResolvedValue({
        id: backupId,
        name: 'Nightly',
        status: BackupStatus.COMPLETED,
      });

      const result = await service.restoreFromBackup(orgId, backupId, userId, userName);

      expect(result.message).toContain('Nightly');
    });
  });
});
