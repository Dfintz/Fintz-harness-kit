/**
 * DocumentService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - missing document / folder / target folder → NotFoundError (statusCode 404)
 * - file too large / invalid share target / folder depth → ValidationError (400)
 * - duplicate folder name / non-empty folder delete → ConflictError (409)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response. The ValidationError (400) and ConflictError (409)
 * paths previously threw a bare Error that fell through to 500, so these guard
 * the 500→400 / 500→409 fixes.
 */
import { Document } from '../../../models/Document';
import { DocumentFolder } from '../../../models/DocumentFolder';
import { DocumentShare, SharePermission } from '../../../models/DocumentShare';
import { DocumentVersion } from '../../../models/DocumentVersion';
import { ConflictError, NotFoundError, ValidationError } from '../../../utils/apiErrors';

const mockDocumentRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  softRemove: jest.fn(),
  // TenantService base reads repository.metadata.name in its constructor
  metadata: { name: 'Document' },
};
const mockFolderRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};
const mockVersionRepo = { findOne: jest.fn(), find: jest.fn(), create: jest.fn(), save: jest.fn() };
const mockShareRepo = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };

jest.mock('../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Document) return mockDocumentRepo;
      if (entity === DocumentFolder) return mockFolderRepo;
      if (entity === DocumentVersion) return mockVersionRepo;
      if (entity === DocumentShare) return mockShareRepo;
      return {};
    }),
  },
}));

jest.mock('../../../services/cloud/DocumentStorageService', () => ({
  getDocumentStorageService: jest.fn(() => ({
    uploadDocument: jest.fn(),
    generateDownloadUrl: jest.fn(),
  })),
}));

jest.mock('../../../websocket/websocketServer', () => ({ emitToOrganization: jest.fn() }));
jest.mock('../../../utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEventType: {},
}));

// Import after mocks
import {
  DocumentService,
  type UploadDocumentDTO,
} from '../../../services/document/DocumentService';

describe('DocumentService — typed error contract', () => {
  let service: DocumentService;

  const orgId = 'org-1';
  const userId = 'user-1';
  const docId = 'doc-1';
  const folderId = 'folder-1';
  const smallBuffer = Buffer.from('hello');
  const hugeBuffer = { length: 51 * 1024 * 1024 } as unknown as Buffer;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DocumentService();
  });

  describe('uploadDocument', () => {
    const dto: UploadDocumentDTO = { name: 'doc.pdf' };

    it('throws ValidationError (400) when the file exceeds the size limit', async () => {
      await expect(
        service.uploadDocument(orgId, userId, 'User', dto, hugeBuffer, 'application/pdf')
      ).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
      await expect(
        service.uploadDocument(orgId, userId, 'User', dto, hugeBuffer, 'application/pdf')
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('throws NotFoundError (404) when the target folder does not exist', async () => {
      mockFolderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.uploadDocument(
          orgId,
          userId,
          'User',
          { name: 'doc.pdf', folderId },
          smallBuffer,
          'application/pdf'
        )
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Folder not found',
      });
    });
  });

  describe('updateDocument', () => {
    it('throws NotFoundError (404) when the document does not exist', async () => {
      mockDocumentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateDocument(orgId, docId, userId, { name: 'new' })
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Document not found',
      });
    });

    it('throws NotFoundError (404) with target-folder message when the new folder is missing', async () => {
      mockDocumentRepo.findOne.mockResolvedValue({ id: docId, folderId: null });
      mockFolderRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateDocument(orgId, docId, userId, { folderId })
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Target folder not found',
      });
    });
  });

  describe('deleteDocument / getDownloadUrl', () => {
    it('deleteDocument throws NotFoundError (404) when missing', async () => {
      mockDocumentRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteDocument(orgId, docId, userId)).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('getDownloadUrl throws NotFoundError (404) when missing', async () => {
      mockDocumentRepo.findOne.mockResolvedValue(null);
      await expect(service.getDownloadUrl(orgId, docId, userId)).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
      });
    });
  });

  describe('shareDocument', () => {
    it('throws ValidationError (400) when neither user nor role is specified', async () => {
      mockDocumentRepo.findOne.mockResolvedValue({ id: docId });

      await expect(
        service.shareDocument(orgId, docId, userId, { permission: SharePermission.VIEW })
      ).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
    });
  });

  describe('createFolder', () => {
    it('throws ConflictError (409) when a folder with the same name exists at the level', async () => {
      mockFolderRepo.findOne.mockResolvedValue({ id: 'existing', name: 'Docs' });

      await expect(service.createFolder(orgId, userId, { name: 'Docs' })).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
      });
      await expect(service.createFolder(orgId, userId, { name: 'Docs' })).rejects.toBeInstanceOf(
        ConflictError
      );
    });
  });

  describe('updateFolder / deleteFolder', () => {
    it('updateFolder throws NotFoundError (404) when missing', async () => {
      mockFolderRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateFolder(orgId, folderId, userId, { name: 'x' })
      ).rejects.toMatchObject({
        name: 'NotFoundError',
        statusCode: 404,
        message: 'Folder not found',
      });
    });

    it('deleteFolder throws NotFoundError (404) when missing', async () => {
      mockFolderRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteFolder(orgId, folderId, userId)).rejects.toBeInstanceOf(
        NotFoundError
      );
    });

    it('deleteFolder throws ConflictError (409) when it contains subfolders', async () => {
      mockFolderRepo.findOne.mockResolvedValue({ id: folderId });
      mockFolderRepo.count.mockResolvedValue(2);

      await expect(service.deleteFolder(orgId, folderId, userId)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
        message: 'Cannot delete folder that contains subfolders',
      });
    });

    it('deleteFolder throws ConflictError (409) when it contains documents', async () => {
      mockFolderRepo.findOne.mockResolvedValue({ id: folderId });
      mockFolderRepo.count.mockResolvedValue(0); // no subfolders
      mockDocumentRepo.count.mockResolvedValue(3); // has documents

      await expect(service.deleteFolder(orgId, folderId, userId)).rejects.toMatchObject({
        name: 'ConflictError',
        statusCode: 409,
        message: 'Cannot delete folder that contains documents',
      });
    });
  });
});
