"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactRequestController = void 0;
const ContactRequest_1 = require("../models/ContactRequest");
const OrganizationPermission_1 = require("../models/OrganizationPermission");
const ContactRequestService_1 = require("../services/organization/ContactRequestService");
const OrganizationFederationService_1 = require("../services/organization/OrganizationFederationService");
const OrganizationMemberService_1 = require("../services/organization/OrganizationMemberService");
const OrganizationPermissionService_1 = require("../services/organization/OrganizationPermissionService");
const apiErrors_1 = require("../utils/apiErrors");
const controllerHelpers_1 = require("../utils/controllerHelpers");
const roleUtils_1 = require("../utils/roleUtils");
const BaseController_1 = require("./BaseController");
class ContactRequestController extends BaseController_1.BaseController {
    contactService = new ContactRequestService_1.ContactRequestService();
    permissionService = new OrganizationPermissionService_1.OrganizationPermissionService();
    memberService = new OrganizationMemberService_1.OrganizationMemberService();
    federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
    submitContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required to send messages');
            }
            const { targetType, organizationId, allianceId, senderName, senderEmail, rsiHandle, discordUsername, subject, message, contactType, visibility, visibleToRoles, } = req.body;
            const senderIp = req.ip || req.socket.remoteAddress;
            const userAgent = req.get('User-Agent');
            const contactRequest = await this.contactService.submitContactRequest({
                targetType: targetType,
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
    getSentMessages = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const pagination = (0, controllerHelpers_1.parsePaginationParams)(req.query);
            const result = await this.contactService.getUserSentMessages(req.user.id, pagination);
            res.json({ success: true, ...result });
        });
    };
    getInboxMessage = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { requestId } = req.params;
            const message = await this.contactService.getUserContactRequest(requestId, req.user.id);
            if (!message) {
                throw new apiErrors_1.NotFoundError('Message not found');
            }
            const replies = await this.contactService.getReplies(requestId);
            res.json({
                success: true,
                data: { ...message, replies },
            });
        });
    };
    addSenderReply = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
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
    archiveMessage = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { requestId } = req.params;
            const archived = await this.contactService.archiveUserMessage(requestId, req.user.id);
            if (!archived) {
                throw new apiErrors_1.NotFoundError('Message not found');
            }
            res.json({ success: true, message: 'Message archived' });
        });
    };
    deleteMessage = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const { requestId } = req.params;
            const deleted = await this.contactService.deleteUserMessage(requestId, req.user.id);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Message not found');
            }
            res.json({ success: true, message: 'Message deleted' });
        });
    };
    getUnreadCount = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const organizationId = req.user.currentOrganizationId;
            const count = await this.contactService.getUserInboxUnreadCount(req.user.id, organizationId);
            res.json({ success: true, data: { count } });
        });
    };
    getContactOptions = async (req, res) => {
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
    getOrganizationContactRequests = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view contact requests');
            }
            const validStatuses = Object.values(ContactRequest_1.ContactRequestStatus);
            const statusFilter = (0, controllerHelpers_1.parseStatusFilter)(req.query, validStatuses);
            const dateFilter = (0, controllerHelpers_1.parseDateRangeFilter)(req.query);
            const searchTerm = (0, controllerHelpers_1.parseSearchTerm)(req.query);
            const pagination = (0, controllerHelpers_1.parsePaginationParams)(req.query);
            const member = await this.memberService.getMember(organizationId, userId);
            const viewerRole = (0, roleUtils_1.getRoleName)(member?.role);
            const filters = {
                ...statusFilter,
                ...dateFilter,
                searchTerm,
                viewerRole,
            };
            const result = await this.contactService.getOrganizationContactRequests(organizationId, filters, pagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    getOrganizationContactStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view contact statistics');
            }
            const stats = await this.contactService.getOrganizationContactRequestStats(organizationId);
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    getOrganizationContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view contact request');
            }
            const contactRequest = await this.contactService.getOrganizationContactRequest(requestId, organizationId);
            if (!contactRequest) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            res.json({
                success: true,
                data: contactRequest,
            });
        });
    };
    updateOrganizationContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update contact request');
            }
            const updated = await this.contactService.updateOrganizationContactRequest(requestId, organizationId, req.body, userId);
            if (!updated) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            res.json({
                success: true,
                message: 'Contact request updated successfully',
                data: updated,
            });
        });
    };
    deleteOrganizationContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.DELETE);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to delete contact request');
            }
            const deleted = await this.contactService.deleteOrganizationContactRequest(requestId, organizationId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            res.json({
                success: true,
                message: 'Contact request deleted successfully',
            });
        });
    };
    getAllianceContactRequests = async (req, res) => {
        await this.execute(req, res, async () => {
            const { allianceId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view alliance contact requests');
            }
            const validStatuses = Object.values(ContactRequest_1.ContactRequestStatus);
            const statusFilter = (0, controllerHelpers_1.parseStatusFilter)(req.query, validStatuses);
            const dateFilter = (0, controllerHelpers_1.parseDateRangeFilter)(req.query);
            const searchTerm = (0, controllerHelpers_1.parseSearchTerm)(req.query);
            const pagination = (0, controllerHelpers_1.parsePaginationParams)(req.query);
            const viewerRole = 'owner';
            const filters = {
                ...statusFilter,
                ...dateFilter,
                searchTerm,
                viewerRole,
            };
            const result = await this.contactService.getAllianceContactRequests(allianceId, filters, pagination);
            res.json({
                success: true,
                ...result,
            });
        });
    };
    getAllianceContactStats = async (req, res) => {
        await this.execute(req, res, async () => {
            const { allianceId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view alliance contact statistics');
            }
            const stats = await this.contactService.getAllianceContactRequestStats(allianceId);
            res.json({
                success: true,
                data: stats,
            });
        });
    };
    getAllianceContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { allianceId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to view alliance contact request');
            }
            const contactRequest = await this.contactService.getAllianceContactRequest(requestId, allianceId);
            if (!contactRequest) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            res.json({
                success: true,
                data: contactRequest,
            });
        });
    };
    updateAllianceContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { allianceId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to update alliance contact request');
            }
            const updated = await this.contactService.updateAllianceContactRequest(requestId, allianceId, req.body, userId);
            if (!updated) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            res.json({
                success: true,
                message: 'Contact request updated successfully',
                data: updated,
            });
        });
    };
    deleteAllianceContactRequest = async (req, res) => {
        await this.execute(req, res, async () => {
            const { allianceId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasAccess = await this.federationService.hasAllianceManageAccess(allianceId, userId);
            if (!hasAccess) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to delete alliance contact request');
            }
            const deleted = await this.contactService.deleteAllianceContactRequest(requestId, allianceId);
            if (!deleted) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            res.json({
                success: true,
                message: 'Contact request deleted successfully',
            });
        });
    };
    getOrganizationContactReplies = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.VIEW);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions');
            }
            const contactRequest = await this.contactService.getOrganizationContactRequest(requestId, organizationId);
            if (!contactRequest) {
                throw new apiErrors_1.NotFoundError('Contact request');
            }
            const replies = await this.contactService.getReplies(requestId);
            res.json({ success: true, data: replies });
        });
    };
    addOrganizationReply = async (req, res) => {
        await this.execute(req, res, async () => {
            const { id: organizationId, requestId } = req.params;
            const userId = req.user?.id;
            if (!userId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            const hasPermission = await this.permissionService.checkPermission(userId, organizationId, OrganizationPermission_1.ResourceType.SETTINGS, OrganizationPermission_1.PermissionAction.EDIT);
            if (!hasPermission.allowed) {
                throw new apiErrors_1.ForbiddenError('Insufficient permissions to reply');
            }
            const contactRequest = await this.contactService.getOrganizationContactRequest(requestId, organizationId);
            if (!contactRequest) {
                throw new apiErrors_1.NotFoundError('Contact request');
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
exports.ContactRequestController = ContactRequestController;
//# sourceMappingURL=contactRequestController.js.map