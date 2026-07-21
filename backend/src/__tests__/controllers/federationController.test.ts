jest.mock('../../services/organization/OrganizationFederationService');

import { Request, Response } from 'express';

import { FederationController } from '../../controllers/federationController';
import { OrganizationFederationService } from '../../services/organization/OrganizationFederationService';

describe('FederationController', () => {
  let controller: FederationController;
  let mockService: jest.Mocked<OrganizationFederationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  const TEST_ORG_ID = 'org-caller';
  const TEST_USER = {
    id: 'user-123',
    username: 'testuser',
    role: 'admin',
    currentOrganizationId: TEST_ORG_ID,
    organizationName: 'Caller Org',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock service
    mockService = {
      removeMember: jest.fn(),
      updateMemberRole: jest.fn(),
      castVote: jest.fn(),
      updateFederation: jest.fn(),
      getFederation: jest.fn(),
      createFederation: jest.fn(),
      getOrganizationFederations: jest.fn(),
      searchFederations: jest.fn(),
      activateFederation: jest.fn(),
      inviteMember: jest.fn(),
      acceptInvitation: jest.fn(),
      createProposal: jest.fn(),
      getProposal: jest.fn(),
      getFederationProposals: jest.fn(),
      addSharedResource: jest.fn(),
      removeSharedResource: jest.fn(),
      createTreaty: jest.fn(),
      terminateTreaty: jest.fn(),
      getFederationStats: jest.fn(),
      getMemberContributions: jest.fn(),
      getPublicFederations: jest.fn(),
      getPublicFederation: jest.fn(),
      getPublicFederationStats: jest.fn(),
    } as unknown as jest.Mocked<OrganizationFederationService>;

    // Mock getInstance to return our mock
    (OrganizationFederationService.getInstance as jest.Mock).mockReturnValue(mockService);

    controller = new FederationController();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      params: {},
      query: {},
      body: {},
      user: TEST_USER,
    };
  });

  // ── removeMember: verify correct argument order ────────────────────────────

  describe('removeMember', () => {
    it('should pass actorOrgId (caller) before targetOrgId (memberId param)', async () => {
      const targetOrgId = 'org-target';
      mockRequest.params = { id: 'fed-001', memberId: targetOrgId };
      mockService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember(mockRequest as Request, mockResponse as Response);

      // Verify: removeMember(federationId, actorOrgId, targetOrgId)
      expect(mockService.removeMember).toHaveBeenCalledWith(
        'fed-001', // federationId
        TEST_ORG_ID, // actorOrgId — the authenticated caller
        targetOrgId // targetOrgId — the member to remove
      );
      expect(mockResponse.status).toHaveBeenCalledWith(204);
    });

    it('should handle service errors gracefully', async () => {
      mockRequest.params = { id: 'fed-001', memberId: 'org-target' };
      mockService.removeMember.mockRejectedValue(new Error('Insufficient permissions'));

      await controller.removeMember(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  // ── updateMemberRole: verify correct argument order ────────────────────────

  describe('updateMemberRole', () => {
    it('should pass actorOrgId (caller) before targetOrgId (memberId param)', async () => {
      const targetOrgId = 'org-target';
      mockRequest.params = { id: 'fed-001', memberId: targetOrgId };
      mockRequest.body = { role: 'leader' };
      mockService.updateMemberRole.mockResolvedValue({
        organizationId: targetOrgId,
        organizationName: 'Target Org',
        role: 'leader',
        joinedAt: new Date(),
        status: 'active',
        votingPower: 1,
        contributions: 0,
      });

      await controller.updateMemberRole(mockRequest as Request, mockResponse as Response);

      // Verify: updateMemberRole(federationId, actorOrgId, targetOrgId, role)
      expect(mockService.updateMemberRole).toHaveBeenCalledWith(
        'fed-001', // federationId
        TEST_ORG_ID, // actorOrgId — the authenticated caller
        targetOrgId, // targetOrgId — the member whose role to update
        'leader' // new role
      );
    });
  });

  // ── castVote: verify org name resolution ───────────────────────────────────

  describe('castVote', () => {
    it('should resolve organization name from federation membership', async () => {
      mockRequest.params = { id: 'fed-001', proposalId: 'prop-001' };
      mockRequest.body = { vote: 'approve', comment: 'Looks good' };

      // getFederation returns federation with caller as a member
      mockService.getFederation.mockResolvedValue({
        id: 'fed-001',
        name: 'Test Federation',
        description: 'Test',
        founderId: 'user-1',
        founderOrgId: 'org-1',
        createdAt: new Date(),
        governance: {} as never,
        members: [
          {
            organizationId: TEST_ORG_ID,
            organizationName: 'Caller Org',
            role: 'member',
            joinedAt: new Date(),
            status: 'active',
            votingPower: 1,
            contributions: 0,
          },
        ],
        sharedResources: [],
        treaties: [],
        status: 'active',
        isPublic: true,
        tags: [],
      });

      mockService.castVote.mockResolvedValue({
        id: 'prop-001',
        federationId: 'fed-001',
        type: 'custom',
        title: 'Test Proposal',
        description: 'Test',
        proposedBy: 'user-1',
        proposedByOrg: 'org-1',
        createdAt: new Date(),
        votingEndsAt: new Date(),
        votes: [],
        status: 'open',
        requiredApproval: 51,
      });

      await controller.castVote(mockRequest as Request, mockResponse as Response);

      // Verify that 'Caller Org' is passed, NOT 'User user-123'
      expect(mockService.castVote).toHaveBeenCalledWith(
        'prop-001',
        TEST_ORG_ID,
        'Caller Org', // resolved org name, not placeholder
        TEST_USER.id,
        'approve',
        'Looks good'
      );
    });

    it('should use fallback name when member not found in federation', async () => {
      mockRequest.params = { id: 'fed-001', proposalId: 'prop-001' };
      mockRequest.body = { vote: 'reject' };

      // Federation has no member matching caller's org
      mockService.getFederation.mockResolvedValue({
        id: 'fed-001',
        name: 'Test Federation',
        description: 'Test',
        founderId: 'user-1',
        founderOrgId: 'org-1',
        createdAt: new Date(),
        governance: {} as never,
        members: [],
        sharedResources: [],
        treaties: [],
        status: 'active',
        isPublic: true,
        tags: [],
      });

      mockService.castVote.mockResolvedValue({
        id: 'prop-001',
        federationId: 'fed-001',
        type: 'custom',
        title: 'Test Proposal',
        description: 'Test',
        proposedBy: 'user-1',
        proposedByOrg: 'org-1',
        createdAt: new Date(),
        votingEndsAt: new Date(),
        votes: [],
        status: 'open',
        requiredApproval: 51,
      });

      await controller.castVote(mockRequest as Request, mockResponse as Response);

      // Should use fallback with org ID prefix
      expect(mockService.castVote).toHaveBeenCalledWith(
        'prop-001',
        TEST_ORG_ID,
        expect.stringContaining('Organization'), // fallback pattern
        TEST_USER.id,
        'reject',
        undefined
      );
    });
  });

  // ── updateFederation: verify all fields are passed ─────────────────────────

  describe('update', () => {
    it('should pass all update fields including governance and URLs', async () => {
      mockRequest.params = { id: 'fed-001' };
      mockRequest.body = {
        name: 'Updated Name',
        description: 'Updated description text',
        governance: { votingSystem: 'unanimous' },
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://example.com',
      };

      mockService.updateFederation.mockResolvedValue({
        id: 'fed-001',
        name: 'Updated Name',
        description: 'Updated description text',
        founderId: 'user-1',
        founderOrgId: 'org-1',
        createdAt: new Date(),
        governance: { votingSystem: 'unanimous' } as never,
        members: [],
        sharedResources: [],
        treaties: [],
        status: 'active',
        isPublic: true,
        tags: [],
        logoUrl: 'https://example.com/logo.png',
        websiteUrl: 'https://example.com',
      });

      await controller.update(mockRequest as Request, mockResponse as Response);

      expect(mockService.updateFederation).toHaveBeenCalledWith(
        'fed-001',
        TEST_ORG_ID,
        expect.objectContaining({
          name: 'Updated Name',
          governance: { votingSystem: 'unanimous' },
          logoUrl: 'https://example.com/logo.png',
          websiteUrl: 'https://example.com',
        })
      );
    });
  });
});
