import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { ContactRequestStatus, ContactTargetType } from '../models/ContactRequest';
import { PermissionAction, ResourceType } from '../models/OrganizationPermission';
import {
  ContactRequestFilterOptions,
  ContactRequestService,
} from '../services/organization/ContactRequestService';
import { OrganizationFederationService } from '../services/organization/OrganizationFederationService';
import { OrganizationMemberService } from '../services/organization/OrganizationMemberService';
import { OrganizationPermissionService } from '../services/organization/OrganizationPermissionService';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../utils/apiErrors';
import {
  parseDateRangeFilter,
  parsePaginationParams,
  parseSearchTerm,
  parseStatusFilter,
} from '../utils/controllerHelpers';
import { getRoleName } from '../utils/roleUtils';

import { BaseController } from './BaseController';

/**
 * Controller for contact request management
 *
 * Provides endpoints for:
 * - Authenticated contact form submission
 * - Organization contact request management (authenticated)
 * - Alliance contact request management (authenticated)
 * - User inbox (sent messages + replies)
 */
export class ContactRequestController extends BaseController {
  private readonly contactService = new ContactRequestService();
  private readonly permissionService = new OrganizationPermissionService();
  private readonly memberService = new OrganizationMemberService();
  private readonly federationService = OrganizationFederationService.getInstance();

  // ==================== AUTHENTICATED CONTACT SUBMISSION ====================

  /**
   * Submit a contact request
   * POST /api/directory/contact
   * Requires authentication
   */
  public submitContactRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required to send messages');
      }

      const {
        targetType,
        organizationId,
        allianceId,
        senderName,
        senderEmail,
        rsiHandle,
        discordUsername,
        subject,
        message,
        contactType,
        visibility,
        visibleToRoles,
      } = req.body;

      // Get sender info for spam prevention
      const senderIp = req.ip || req.socket.remoteAddress;
      const userAgent = req.get('User-Agent');

      const contactRequest = await this.contactService.submitContactRequest({
        targetType: targetType as ContactTargetType,
        organizationId,
        allianceId,
        senderUserId: req.user.id,
        senderName,
        senderEmail,
        rsiHandle,
        discordUsername,
        subject,
        message,
        contactType,
        visibility,
        visibleToRoles,
        senderIp,
        userAgent,
      });

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          id: contactRequest.id,
          createdAt: contactRequest.createdAt,
        },
      });
    });
  };

  // ==================== USER INBOX ENDPOINTS ====================

  /**
   * Get current user's sent messages
   * GET /api/inbox/sent
   */
  public getSentMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const pagination = parsePaginationParams(req.query);

      const result = await this.contactService.getUserSentMessages(req.user.id, pagination);

      res.json({ success: true, ...result });
    });
  };

  /**
   * Get a specific sent message with replies
   * GET /api/inbox/:requestId
   */
  public getInboxMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const { requestId } = req.params;
      const message = await this.contactService.getUserContactRequest(requestId, req.user.id);

      if (!message) {
        throw new NotFoundError('Message not found');
      }

      const replies = await this.contactService.getReplies(requestId);

      res.json({
        success: true,
        data: { ...message, replies },
      });
    });
  };

  /**
   * Add a reply to a contact request (sender replying back)
   * POST /api/inbox/:requestId/replies
   */
  public addSenderReply = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const { requestId } = req.params;
      const { message } = req.body;

      const reply = await this.contactService.addReply({
        contactRequestId: requestId,
        senderUserId: req.user.id,
        message,
        isOrgReply: false,
      });

      res.status(201).json({
        success: true,
        data: {
          id: reply.id,
          contactRequestId: reply.contactRequestId,
          senderUserId: reply.senderUserId,
          senderUsername: reply.senderUser?.username,
          senderAvatar: reply.senderUser?.avatar ?? undefined,
          message: reply.message,
          isOrgReply: reply.isOrgReply,
          createdAt: reply.createdAt,
        },
      });
    });
  };

  /**
   * Archive a sent message (hide it from the sender's inbox)
   * PATCH /api/inbox/:requestId/archive
   */
  public archiveMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const { requestId } = req.params;
      const archived = await this.contactService.archiveUserMessage(requestId, req.user.id);

      if (!archived) {
        throw new NotFoundError('Message not found');
      }

      res.json({ success: true, message: 'Message archived' });
    });
  };

  /**
   * Permanently delete a sent message
   * DELETE /api/inbox/:requestId
   */
  public deleteMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const { requestId } = req.params;
      const deleted = await this.contactService.deleteUserMessage(requestId, req.user.id);

      if (!deleted) {
        throw new NotFoundError('Message not found');
      }

      res.json({ success: true, message: 'Message deleted' });
    });
  };

  /**
   * Get unread inbox count
   * GET /api/inbox/unread-count
   */
  public getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      if (!req.user?.id) {
        throw new UnauthorizedError('Authentication required');
      }

      const organizationId = req.user.currentOrganizationId;
      const count = await this.contactService.getUserInboxUnreadCount(req.user.id, organizationId);

      res.json({ success: true, data: { count } });
    });
  };

  /**
   * Get contact type options
   * GET /api/directory/contact/options
   * No authentication required
   */
  public getContactOptions = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      res.json({
        success: true,
        data: {
          contactTypes: this.contactService.getContactTypeOptions(),
          targetTypes: this.contactService.getTargetTypeOptions(),
        },
      });
    });
  };

  // ==================== ORGANIZATION CONTACT MANAGEMENT (AUTHENTICATED) ====================

  /**
   * Get organization contact requests
   * GET /api/organizations/:id/contact-requests
   * Requires authentication and org permission
   */
  public getOrganizationContactRequests = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view contact requests');
      }

      // Parse query parameters using helper functions
      const validStatuses = Object.values(ContactRequestStatus);
      const statusFilter = parseStatusFilter(req.query, validStatuses);
      const dateFilter = parseDateRangeFilter(req.query);
      const searchTerm = parseSearchTerm(req.query);
      const pagination = parsePaginationParams(req.query);

      // Get viewer's role for visibility filtering
      const member = await this.memberService.getMember(organizationId, userId);
      const viewerRole = getRoleName(member?.role);

      const filters: ContactRequestFilterOptions = {
        ...statusFilter,
        ...dateFilter,
        searchTerm,
        viewerRole,
      };

      const result = await this.contactService.getOrganizationContactRequests(
        organizationId,
        filters,
        pagination
      );

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Get organization contact request statistics
   * GET /api/organizations/:id/contact-requests/stats
   * Requires authentication and org permission
   */
  public getOrganizationContactStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view contact statistics');
      }

      const stats = await this.contactService.getOrganizationContactRequestStats(organizationId);

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  /**
   * Get a specific organization contact request
   * GET /api/organizations/:id/contact-requests/:requestId
   * Requires authentication and org permission
   */
  public getOrganizationContactRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.VIEW
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to view contact request');
      }

      const contactRequest = await this.contactService.getOrganizationContactRequest(
        requestId,
        organizationId
      );

      if (!contactRequest) {
        throw new NotFoundError('Contact request');
      }

      res.json({
        success: true,
        data: contactRequest,
      });
    });
  };

  /**
   * Update an organization contact request
   * PATCH /api/organizations/:id/contact-requests/:requestId
   * Requires authentication and org permission
   */
  public updateOrganizationContactRequest = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.EDIT
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to update contact request');
      }

      const updated = await this.contactService.updateOrganizationContactRequest(
        requestId,
        organizationId,
        req.body,
        userId
      );

      if (!updated) {
        throw new NotFoundError('Contact request');
      }

      res.json({
        success: true,
        message: 'Contact request updated successfully',
        data: updated,
      });
    });
  };

  /**
   * Delete an organization contact request
   * DELETE /api/organizations/:id/contact-requests/:requestId
   * Requires authentication and org permission
   */
  public deleteOrganizationContactRequest = async (
    req: AuthRequest,
    res: Response
  ): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check permission
      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.DELETE
      );

      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to delete contact request');
      }

      const deleted = await this.contactService.deleteOrganizationContactRequest(
        requestId,
        organizationId
      );

      if (!deleted) {
        throw new NotFoundError('Contact request');
      }

      res.json({
        success: true,
        message: 'Contact request deleted successfully',
      });
    });
  };

  // ==================== ALLIANCE CONTACT MANAGEMENT (AUTHENTICATED) ====================

  /**
   * Get alliance contact requests
   * GET /api/federations/:allianceId/contact-requests
   * Requires authentication and alliance permission
   */
  public getAllianceContactRequests = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { allianceId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is a leader/council member of the alliance
      const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
      if (!hasAccess) {
        throw new ForbiddenError('Insufficient permissions to view alliance contact requests');
      }

      // Parse query parameters using helper functions
      const validStatuses = Object.values(ContactRequestStatus);
      const statusFilter = parseStatusFilter(req.query, validStatuses);
      const dateFilter = parseDateRangeFilter(req.query);
      const searchTerm = parseSearchTerm(req.query);
      const pagination = parsePaginationParams(req.query);

      // Alliance leaders have access to all messages (equivalent to org owner/admin)
      const viewerRole = 'owner'; // Alliance leaders see all messages

      const filters: ContactRequestFilterOptions = {
        ...statusFilter,
        ...dateFilter,
        searchTerm,
        viewerRole,
      };

      const result = await this.contactService.getAllianceContactRequests(
        allianceId,
        filters,
        pagination
      );

      res.json({
        success: true,
        ...result,
      });
    });
  };

  /**
   * Get alliance contact request statistics
   * GET /api/federations/:allianceId/contact-requests/stats
   * Requires authentication and alliance permission
   */
  public getAllianceContactStats = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { allianceId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is a leader/council member of the alliance
      const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
      if (!hasAccess) {
        throw new ForbiddenError('Insufficient permissions to view alliance contact statistics');
      }

      const stats = await this.contactService.getAllianceContactRequestStats(allianceId);

      res.json({
        success: true,
        data: stats,
      });
    });
  };

  /**
   * Get a specific alliance contact request
   * GET /api/federations/:allianceId/contact-requests/:requestId
   * Requires authentication and alliance permission
   */
  public getAllianceContactRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { allianceId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is a leader/council member of the alliance
      const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
      if (!hasAccess) {
        throw new ForbiddenError('Insufficient permissions to view alliance contact request');
      }

      const contactRequest = await this.contactService.getAllianceContactRequest(
        requestId,
        allianceId
      );

      if (!contactRequest) {
        throw new NotFoundError('Contact request');
      }

      res.json({
        success: true,
        data: contactRequest,
      });
    });
  };

  /**
   * Update an alliance contact request
   * PATCH /api/federations/:allianceId/contact-requests/:requestId
   * Requires authentication and alliance permission
   */
  public updateAllianceContactRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { allianceId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is a leader/council member of the alliance
      const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
      if (!hasAccess) {
        throw new ForbiddenError('Insufficient permissions to update alliance contact request');
      }

      const updated = await this.contactService.updateAllianceContactRequest(
        requestId,
        allianceId,
        req.body,
        userId
      );

      if (!updated) {
        throw new NotFoundError('Contact request');
      }

      res.json({
        success: true,
        message: 'Contact request updated successfully',
        data: updated,
      });
    });
  };

  /**
   * Delete an alliance contact request
   * DELETE /api/federations/:allianceId/contact-requests/:requestId
   * Requires authentication and alliance permission
   */
  public deleteAllianceContactRequest = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { allianceId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      // Check if user is a leader/council member of the alliance
      const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
      if (!hasAccess) {
        throw new ForbiddenError('Insufficient permissions to delete alliance contact request');
      }

      const deleted = await this.contactService.deleteAllianceContactRequest(requestId, allianceId);

      if (!deleted) {
        throw new NotFoundError('Contact request');
      }

      res.json({
        success: true,
        message: 'Contact request deleted successfully',
      });
    });
  };

  // ==================== REPLY MANAGEMENT (ORGANIZATION) ====================

  /**
   * Get replies for an org contact request
   * GET /api/organizations/:id/contact-requests/:requestId/replies
   */
  public getOrganizationContactReplies = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.VIEW
      );
      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions');
      }

      // Verify the contact request belongs to this org
      const contactRequest = await this.contactService.getOrganizationContactRequest(
        requestId,
        organizationId
      );
      if (!contactRequest) {
        throw new NotFoundError('Contact request');
      }

      const replies = await this.contactService.getReplies(requestId);
      res.json({ success: true, data: replies });
    });
  };

  /**
   * Add org admin reply to a contact request
   * POST /api/organizations/:id/contact-requests/:requestId/replies
   */
  public addOrganizationReply = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const { id: organizationId, requestId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new UnauthorizedError('Authentication required');
      }

      const hasPermission = await this.permissionService.checkPermission(
        userId,
        organizationId,
        ResourceType.SETTINGS,
        PermissionAction.EDIT
      );
      if (!hasPermission.allowed) {
        throw new ForbiddenError('Insufficient permissions to reply');
      }

      // Verify the contact request belongs to this org
      const contactRequest = await this.contactService.getOrganizationContactRequest(
        requestId,
        organizationId
      );
      if (!contactRequest) {
        throw new NotFoundError('Contact request');
      }

      const { message } = req.body;
      const reply = await this.contactService.addReply({
        contactRequestId: requestId,
        senderUserId: userId,
        message,
        isOrgReply: true,
      });

      res.status(201).json({
        success: true,
        data: {
          id: reply.id,
          contactRequestId: reply.contactRequestId,
          senderUserId: reply.senderUserId,
          senderUsername: reply.senderUser?.username,
          senderAvatar: reply.senderUser?.avatar ?? undefined,
          message: reply.message,
          isOrgReply: reply.isOrgReply,
          createdAt: reply.createdAt,
        },
      });
    });
  };
}
