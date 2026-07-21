import { Request, Response } from 'express';

import { ApprovalController } from '../../controllers/v2/approvalController';
import { ApprovalRequestType } from '../../models/ApprovalRequest';

const mockApprovalServiceInstance = {
  getApproval: jest.fn(),
  approve: jest.fn(),
  reject: jest.fn(),
  delegate: jest.fn(),
  listApprovals: jest.fn(),
  createApproval: jest.fn(),
  getPending: jest.fn(),
};

jest.mock('../../config/database', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));
jest.mock('../../services/approval/ApprovalService', () => ({
  ApprovalService: jest.fn(() => mockApprovalServiceInstance),
  ApprovalAuditAction: {},
}));

const ORG_ID = 'org-1';
const USER_ID = 'user-low-priv';

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    params: { approvalId: 'appr-1' },
    query: {},
    body: {},
    user: { id: USER_ID, username: 'u', role: 'member', currentOrganizationId: ORG_ID },
    ...overrides,
  } as unknown as Request;
}

function buildRes(): { res: Response; statusSpy: jest.Mock; jsonSpy: jest.Mock } {
  const jsonSpy = jest.fn().mockReturnThis();
  const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
  return {
    res: { status: statusSpy, json: jsonSpy } as unknown as Response,
    statusSpy,
    jsonSpy,
  };
}

describe('ApprovalController — role_change guard on the generic surface', () => {
  let controller: ApprovalController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ApprovalController();
  });

  it('blocks approve for a role_change approval (must use /role-requests)', async () => {
    mockApprovalServiceInstance.getApproval.mockResolvedValue({
      id: 'appr-1',
      type: ApprovalRequestType.ROLE_CHANGE,
    });
    const { res, statusSpy } = buildRes();

    await controller.approve(buildReq(), res);

    expect(mockApprovalServiceInstance.approve).not.toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(403);
  });

  it('blocks reject for a role_change approval', async () => {
    mockApprovalServiceInstance.getApproval.mockResolvedValue({
      id: 'appr-1',
      type: ApprovalRequestType.ROLE_CHANGE,
    });
    const { res, statusSpy } = buildRes();

    await controller.reject(buildReq({ body: { reason: 'no' } } as Partial<Request>), res);

    expect(mockApprovalServiceInstance.reject).not.toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(403);
  });

  it('blocks delegate for a role_change approval', async () => {
    mockApprovalServiceInstance.getApproval.mockResolvedValue({
      id: 'appr-1',
      type: ApprovalRequestType.ROLE_CHANGE,
    });
    const { res, statusSpy } = buildRes();

    await controller.delegate(buildReq({ body: { userId: 'other' } } as Partial<Request>), res);

    expect(mockApprovalServiceInstance.delegate).not.toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(403);
  });

  it('allows approve for a non-role_change approval', async () => {
    mockApprovalServiceInstance.getApproval.mockResolvedValue({ id: 'appr-1', type: 'membership' });
    mockApprovalServiceInstance.approve.mockResolvedValue({ id: 'appr-1', status: 'approved' });
    const { res } = buildRes();

    await controller.approve(buildReq(), res);

    expect(mockApprovalServiceInstance.approve).toHaveBeenCalledWith(
      'appr-1',
      ORG_ID,
      USER_ID,
      undefined
    );
  });
});
