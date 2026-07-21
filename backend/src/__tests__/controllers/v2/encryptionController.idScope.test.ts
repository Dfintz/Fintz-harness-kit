import { Request, Response } from 'express';

const mockGetEncryptedData = jest.fn();
const mockDeleteEncryptedData = jest.fn();
const mockUpdateReEncryptedData = jest.fn();

jest.mock('../../../services/encryption/OrganizationEncryptionService', () => ({
  OrganizationEncryptionService: jest.fn().mockImplementation(() => ({
    getEncryptedData: mockGetEncryptedData,
    deleteEncryptedData: mockDeleteEncryptedData,
    updateReEncryptedData: mockUpdateReEncryptedData,
  })),
}));

const mockFindOneMembership = jest.fn();

jest.mock('../../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn().mockImplementation((entity: { name: string }) => {
      if (entity.name === 'OrganizationMembership') {
        return { findOne: mockFindOneMembership };
      }
      return { findOne: jest.fn() };
    }),
  },
}));

jest.mock('../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../../utils/authHelpers', () => ({
  getAuthenticatedUserId: jest.fn().mockReturnValue('user-1'),
}));

jest.mock('../../../utils/roleUtils', () => ({
  getRoleName: jest.fn().mockReturnValue('admin'),
  isOwnerOrAdminRole: jest.fn().mockReturnValue(true),
  isOwnerRole: jest.fn().mockReturnValue(true),
}));

import { EncryptionControllerV2 } from '../../../controllers/v2/encryptionController';

describe('EncryptionControllerV2 id-scoped endpoints', () => {
  let controller: EncryptionControllerV2;
  let mockRes: Partial<Response>;

  const ORG_ID = 'org-1';
  const USER_ID = 'user-1';
  const DATA_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new EncryptionControllerV2();
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockFindOneMembership.mockResolvedValue({
      organizationId: ORG_ID,
      userId: USER_ID,
      role: 3,
      isActive: true,
      securityLevel: 3,
    });
  });

  it('rejects cross-tenant getEncryptedData when membership does not exist for route organization', async () => {
    mockFindOneMembership.mockResolvedValue(null);

    const mockReq = {
      params: { organizationId: 'org-other', dataId: DATA_ID },
      user: { id: USER_ID },
    } as unknown as Request;

    await expect(controller.getEncryptedData(mockReq, mockRes as Response)).rejects.toThrow(
      'You are not a member of this organization'
    );
    expect(mockGetEncryptedData).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant deleteEncryptedData when membership does not exist for route organization', async () => {
    mockFindOneMembership.mockResolvedValue(null);

    const mockReq = {
      params: { organizationId: 'org-other', dataId: DATA_ID },
      user: { id: USER_ID },
    } as unknown as Request;

    await expect(controller.deleteEncryptedData(mockReq, mockRes as Response)).rejects.toThrow(
      'You are not a member of this organization'
    );
    expect(mockDeleteEncryptedData).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant submitReEncryptedData when membership does not exist for route organization', async () => {
    mockFindOneMembership.mockResolvedValue(null);

    const mockReq = {
      params: { organizationId: 'org-other', dataId: DATA_ID },
      body: {
        newKeyId: 'new-key',
        encryptedData: 'blob',
        encryptionMetadata: { iv: 'iv', authTag: 'tag', algorithm: 'aes-256-gcm' },
      },
      user: { id: USER_ID },
    } as unknown as Request;

    await expect(controller.submitReEncryptedData(mockReq, mockRes as Response)).rejects.toThrow(
      'You are not a member of this organization'
    );
    expect(mockUpdateReEncryptedData).not.toHaveBeenCalled();
  });

  it('passes organizationId to service methods for id-scoped calls', async () => {
    const mockReqGet = {
      params: { organizationId: ORG_ID, dataId: DATA_ID },
      user: { id: USER_ID },
    } as unknown as Request;

    mockGetEncryptedData.mockResolvedValue({
      id: DATA_ID,
      keyId: 'key-1',
      dataType: 'document',
      resourceId: null,
      encryptedData: 'blob',
      encryptionMetadata: { iv: 'iv', authTag: 'tag', algorithm: 'aes-256-gcm' },
      createdAt: new Date(),
    });

    await controller.getEncryptedData(mockReqGet, mockRes as Response);
    expect(mockGetEncryptedData).toHaveBeenCalledWith(ORG_ID, DATA_ID, USER_ID, 3, 'admin');
  });
});
