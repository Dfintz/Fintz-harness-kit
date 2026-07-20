"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationDeletionService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const storage_blob_1 = require("@azure/storage-blob");
const data_source_1 = require("../../data-source");
const Fleet_1 = require("../../models/Fleet");
const FleetInventory_1 = require("../../models/FleetInventory");
const Organization_1 = require("../../models/Organization");
const OrganizationActivity_1 = require("../../models/OrganizationActivity");
const OrganizationDeletionRequest_1 = require("../../models/OrganizationDeletionRequest");
const OrganizationInventory_1 = require("../../models/OrganizationInventory");
const OrganizationMembership_1 = require("../../models/OrganizationMembership");
const OrganizationRelationship_1 = require("../../models/OrganizationRelationship");
const OrganizationShip_1 = require("../../models/OrganizationShip");
const TeamMember_1 = require("../../models/TeamMember");
const TradingRoute_1 = require("../../models/TradingRoute");
const User_1 = require("../../models/User");
const encryption_1 = require("../../utils/encryption");
const logger_1 = require("../../utils/logger");
const retryHelper_1 = require("../../utils/retryHelper");
const roleUtils_1 = require("../../utils/roleUtils");
const AuditService_1 = require("../audit/AuditService");
const AzureBlobService_1 = require("../cloud/AzureBlobService");
const email_1 = require("../communication/email");
const OrganizationActivityService_1 = require("./OrganizationActivityService");
const OrganizationArchiveService_1 = require("./OrganizationArchiveService");
const OrganizationDeletionNotificationService_1 = require("./OrganizationDeletionNotificationService");
const OrganizationHierarchyService_1 = require("./OrganizationHierarchyService");
class OrganizationDeletionService {
    static encryptionKeyWarningLogged = false;
    deletionRequestRepository;
    organizationRepository;
    membershipRepository;
    shipRepository;
    userRepository;
    archiveService;
    hierarchyService;
    activityService;
    notificationService;
    blobService;
    encryptionAlgorithm = 'aes-256-gcm';
    encryptionKey;
    hasValidEncryptionKey;
    constructor() {
        this.deletionRequestRepository = data_source_1.AppDataSource.getRepository(OrganizationDeletionRequest_1.OrganizationDeletionRequest);
        this.organizationRepository = data_source_1.AppDataSource.getRepository(Organization_1.Organization);
        this.membershipRepository = data_source_1.AppDataSource.getRepository(OrganizationMembership_1.OrganizationMembership);
        this.shipRepository = data_source_1.AppDataSource.getRepository(OrganizationShip_1.OrganizationShip);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.archiveService = OrganizationArchiveService_1.OrganizationArchiveService.getInstance();
        this.hierarchyService = new OrganizationHierarchyService_1.OrganizationHierarchyService();
        this.activityService = new OrganizationActivityService_1.OrganizationActivityService();
        this.notificationService = new OrganizationDeletionNotificationService_1.OrganizationDeletionNotificationService();
        this.blobService = new AzureBlobService_1.AzureBlobService();
        const keyHex = process.env.ENCRYPTION_KEY || '';
        if (!(0, encryption_1.isValidEncryptionKeyFormat)(keyHex, 64)) {
            if (!OrganizationDeletionService.encryptionKeyWarningLogged) {
                logger_1.logger.error('ENCRYPTION_KEY not configured (required: 64 hex characters)');
                logger_1.logger.warn('⚠️  Organization data exports will use temporary key - NOT SECURE');
                logger_1.logger.warn('To fix: Set ENCRYPTION_KEY=$(openssl rand -hex 32) in environment');
                OrganizationDeletionService.encryptionKeyWarningLogged = true;
            }
            this.encryptionKey = crypto_1.default.randomBytes(32);
            this.hasValidEncryptionKey = false;
        }
        else {
            this.encryptionKey = Buffer.from(keyHex.slice(0, 64), 'hex');
            this.hasValidEncryptionKey = true;
        }
    }
    async createDeletionRequest(organizationId, requestedBy, options = {}) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        if (organization.isArchived) {
            throw new Error('Organization is already archived');
        }
        const existingRequest = await this.deletionRequestRepository.findOne({
            where: {
                organizationId,
                status: OrganizationDeletionRequest_1.OrgDeletionRequestStatus.PENDING,
            },
        });
        if (existingRequest) {
            throw new Error('A deletion request for this organization is already pending');
        }
        const gracePeriodDays = Math.max(Organization_1.MIN_GRACE_PERIOD_DAYS, Math.min(Organization_1.MAX_GRACE_PERIOD_DAYS, options.gracePeriodDays || 30));
        const preview = await this.generateDeletionPreview(organizationId, options.deleteDescendants || false);
        const request = this.deletionRequestRepository.create({
            id: crypto_1.default.randomUUID(),
            organizationId,
            requestedBy,
            status: OrganizationDeletionRequest_1.OrgDeletionRequestStatus.EMAIL_VERIFICATION_PENDING,
            requestedAt: new Date(),
            requestReason: options.reason,
            deleteDescendants: options.deleteDescendants || false,
            gracePeriodDays,
            deletionPreview: preview,
            requestIpAddress: options.ipAddress,
            requestUserAgent: options.userAgent,
            emailVerificationToken: crypto_1.default.randomBytes(32).toString('hex'),
        });
        const savedRequest = await this.deletionRequestRepository.save(request);
        await this.activityService.logActivity({
            organizationId,
            actorId: requestedBy,
            actorType: 'user',
            action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
            description: `Deletion request created: ${preview.organizationName}`,
            severity: OrganizationActivity_1.ActivitySeverity.CRITICAL,
            metadata: {
                requestId: savedRequest.id,
                deleteDescendants: options.deleteDescendants,
                gracePeriodDays,
                reason: options.reason,
            },
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_DELETION_REQUESTED',
            message: `Organization deletion request created: ${organization.name}`,
            userId: requestedBy,
            organizationId,
            resource: `organization/${organizationId}`,
            metadata: {
                requestId: savedRequest.id,
                deleteDescendants: options.deleteDescendants,
                reason: options.reason,
            },
        });
        logger_1.logger.info('Organization deletion request created', {
            organizationId,
            requestId: savedRequest.id,
            requestedBy,
        });
        await this.notificationService.notifyRequestCreated(savedRequest);
        await this.sendEmailVerification(savedRequest.id);
        return savedRequest;
    }
    async approveDeletionRequest(requestId, approvedBy, options = {}) {
        const request = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
            relations: ['organization'],
        });
        if (!request) {
            throw new Error('Deletion request not found');
        }
        if (!request.canBeApproved()) {
            throw new Error(`Deletion request cannot be approved in ${request.status} status`);
        }
        const scheduledFor = new Date();
        scheduledFor.setDate(scheduledFor.getDate() + request.gracePeriodDays);
        request.status = OrganizationDeletionRequest_1.OrgDeletionRequestStatus.APPROVED;
        request.approvedAt = new Date();
        request.approvedBy = approvedBy;
        request.approvalNotes = options.notes;
        request.scheduledFor = scheduledFor;
        const savedRequest = await this.deletionRequestRepository.save(request);
        if (options.generateExport) {
            await this.generateDataExport(request);
        }
        await this.activityService.logActivity({
            organizationId: request.organizationId,
            actorId: approvedBy,
            actorType: 'user',
            action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
            description: `Deletion request approved`,
            severity: OrganizationActivity_1.ActivitySeverity.CRITICAL,
            metadata: {
                requestId: savedRequest.id,
                scheduledFor,
                notes: options.notes,
            },
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_DELETION_APPROVED',
            message: `Organization deletion request approved: ${request.organization?.name}`,
            userId: approvedBy,
            organizationId: request.organizationId,
            resource: `organization/${request.organizationId}/deletion`,
            metadata: {
                requestId: savedRequest.id,
                scheduledFor,
                notes: options.notes,
            },
        });
        logger_1.logger.info('Organization deletion request approved', {
            requestId: savedRequest.id,
            approvedBy,
            scheduledFor,
        });
        await this.notificationService.notifyRequestApproved(savedRequest);
        return savedRequest;
    }
    async rejectDeletionRequest(requestId, rejectedBy, reason) {
        const request = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
            relations: ['organization'],
        });
        if (!request) {
            throw new Error('Deletion request not found');
        }
        if (!request.canBeRejected()) {
            throw new Error(`Deletion request cannot be rejected in ${request.status} status`);
        }
        request.status = OrganizationDeletionRequest_1.OrgDeletionRequestStatus.REJECTED;
        request.rejectedAt = new Date();
        request.rejectedBy = rejectedBy;
        request.rejectionReason = reason;
        const savedRequest = await this.deletionRequestRepository.save(request);
        await this.activityService.logActivity({
            organizationId: request.organizationId,
            actorId: rejectedBy,
            actorType: 'user',
            action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
            description: `Deletion request rejected`,
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            metadata: {
                requestId: savedRequest.id,
                reason,
            },
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_DELETION_REJECTED',
            message: `Organization deletion request rejected: ${request.organization?.name}`,
            userId: rejectedBy,
            organizationId: request.organizationId,
            resource: `organization/${request.organizationId}/deletion`,
            metadata: {
                requestId: savedRequest.id,
                reason,
            },
        });
        logger_1.logger.info('Organization deletion request rejected', {
            requestId: savedRequest.id,
            rejectedBy,
            reason,
        });
        await this.notificationService.notifyRequestRejected(savedRequest);
        return savedRequest;
    }
    async cancelDeletionRequest(requestId, cancelledBy, reason) {
        const request = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
            relations: ['organization'],
        });
        if (!request) {
            throw new Error('Deletion request not found');
        }
        if (!request.canBeCancelled()) {
            throw new Error(`Deletion request cannot be cancelled in ${request.status} status or grace period has expired`);
        }
        request.status = OrganizationDeletionRequest_1.OrgDeletionRequestStatus.CANCELLED;
        request.cancelledAt = new Date();
        request.cancelledBy = cancelledBy;
        request.cancellationReason = reason;
        const savedRequest = await this.deletionRequestRepository.save(request);
        await this.activityService.logActivity({
            organizationId: request.organizationId,
            actorId: cancelledBy,
            actorType: 'user',
            action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
            description: `Deletion request cancelled`,
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            metadata: {
                requestId: savedRequest.id,
                reason,
            },
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_DELETION_CANCELLED',
            message: `Organization deletion request cancelled: ${request.organization?.name}`,
            userId: cancelledBy,
            organizationId: request.organizationId,
            resource: `organization/${request.organizationId}/deletion`,
            metadata: {
                requestId: savedRequest.id,
                reason,
            },
        });
        logger_1.logger.info('Organization deletion request cancelled', {
            requestId: savedRequest.id,
            cancelledBy,
            reason,
        });
        await this.notificationService.notifyRequestCancelled(savedRequest);
        return savedRequest;
    }
    async executeDeletion(requestId) {
        const request = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
            relations: ['organization'],
        });
        if (!request) {
            throw new Error('Deletion request not found');
        }
        if (request.status !== OrganizationDeletionRequest_1.OrgDeletionRequestStatus.APPROVED) {
            throw new Error('Only approved deletion requests can be executed');
        }
        if (!request.isGracePeriodExpired()) {
            throw new Error('Grace period has not expired yet');
        }
        const organization = request.organization;
        if (!organization) {
            throw new Error('Organization not found');
        }
        try {
            await this.archiveService.archiveOrganization(request.organizationId, request.approvedBy || request.requestedBy, `Deletion request executed: ${request.requestReason || 'No reason provided'}`);
            request.status = OrganizationDeletionRequest_1.OrgDeletionRequestStatus.COMPLETED;
            request.completedAt = new Date();
            await this.deletionRequestRepository.save(request);
            await this.activityService.logActivity({
                organizationId: request.organizationId,
                actorId: request.approvedBy || request.requestedBy,
                actorType: 'system',
                action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
                description: `Organization archived: ${organization.name}`,
                severity: OrganizationActivity_1.ActivitySeverity.CRITICAL,
                metadata: {
                    requestId: request.id,
                    deleteDescendants: request.deleteDescendants,
                },
            });
            AuditService_1.auditService.log({
                category: AuditService_1.AuditCategory.ORGANIZATION,
                action: 'ORG_DELETED',
                message: `Organization deletion executed: ${organization.name}`,
                userId: request.approvedBy || request.requestedBy,
                organizationId: request.organizationId,
                resource: `organization/${request.organizationId}`,
                metadata: {
                    requestId: request.id,
                    deleteDescendants: request.deleteDescendants,
                },
            });
            logger_1.logger.info('Organization deletion executed', {
                requestId: request.id,
                organizationId: request.organizationId,
                organizationName: organization.name,
            });
            await this.notificationService.notifyDeletionCompleted(request);
        }
        catch (error) {
            request.status = OrganizationDeletionRequest_1.OrgDeletionRequestStatus.FAILED;
            request.failureReason = error instanceof Error ? error.message : 'Unknown error';
            await this.deletionRequestRepository.save(request);
            logger_1.logger.error('Organization deletion failed', {
                requestId: request.id,
                organizationId: request.organizationId,
                error,
            });
            throw error;
        }
    }
    async generateDeletionPreview(organizationId, deleteDescendants) {
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        let descendantCount = 0;
        let memberCount = 0;
        let shipCount = 0;
        let organizationIds = [organizationId];
        if (deleteDescendants) {
            const descendants = await this.hierarchyService.getDescendants(organizationId);
            descendantCount = descendants.length;
            organizationIds = [organizationId, ...descendants.map(d => d.id)];
        }
        if (organizationIds.length > 0) {
            const memberCountResult = await this.membershipRepository
                .createQueryBuilder('membership')
                .where('membership.organizationId IN (:...ids)', { ids: organizationIds })
                .getCount();
            memberCount = memberCountResult;
            const shipCountResult = await this.shipRepository
                .createQueryBuilder('ship')
                .where('ship.organizationId IN (:...ids)', { ids: organizationIds })
                .getCount();
            shipCount = shipCountResult;
        }
        const estimatedRecords = memberCount + shipCount + descendantCount;
        const estimatedSizeKB = estimatedRecords * 2;
        const estimatedDataSize = estimatedSizeKB > 1024
            ? `${(estimatedSizeKB / 1024).toFixed(2)} MB`
            : `${estimatedSizeKB} KB`;
        return {
            organizationId,
            organizationName: organization.name,
            descendantCount,
            memberCount,
            shipCount,
            estimatedDataSize,
            willDeleteDescendants: deleteDescendants,
        };
    }
    async generateDataExport(request) {
        try {
            logger_1.logger.info('Starting data export generation', {
                requestId: request.id,
                organizationId: request.organizationId,
            });
            if (!this.hasValidEncryptionKey && process.env.NODE_ENV === 'production') {
                logger_1.logger.warn('Data export using temporary encryption key in production - exports may not be secure', {
                    requestId: request.id,
                    organizationId: request.organizationId,
                });
            }
            const exportData = await (0, retryHelper_1.retryWithBackoff)(() => this.aggregateOrganizationData(request), {
                maxAttempts: 3,
                initialDelayMs: 1000,
                onRetry: (error, attempt) => {
                    logger_1.logger.warn('Retrying data aggregation', {
                        requestId: request.id,
                        attempt,
                        error: error.message,
                    });
                },
            });
            const jsonData = JSON.stringify(exportData, null, 2);
            const { encryptedData, iv, authTag } = this.encryptData(jsonData);
            const exportPath = await (0, retryHelper_1.retryWithBackoff)(() => this.uploadExportToBlob(request.organizationId, request.id, encryptedData, {
                iv: iv.toString('hex'),
                authTag: authTag.toString('hex'),
            }), {
                maxAttempts: 3,
                initialDelayMs: 2000,
                onRetry: (error, attempt) => {
                    logger_1.logger.warn('Retrying blob upload', {
                        requestId: request.id,
                        attempt,
                        error: error.message,
                    });
                },
            });
            const downloadToken = await this.generateSasToken(exportPath, 7);
            request.dataExportGenerated = true;
            request.exportFilePath = exportPath;
            request.exportDownloadToken = downloadToken;
            await this.deletionRequestRepository.save(request);
            await (0, retryHelper_1.retryWithBackoff)(() => this.sendExportNotificationEmail(request, downloadToken), {
                maxAttempts: 2,
                initialDelayMs: 1000,
                onRetry: (error, attempt) => {
                    logger_1.logger.warn('Retrying email notification', {
                        requestId: request.id,
                        attempt,
                        error: error.message,
                    });
                },
            });
            logger_1.logger.info('Data export generated successfully', {
                requestId: request.id,
                exportPath,
                dataSize: jsonData.length,
            });
            return exportPath;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate data export', {
                requestId: request.id,
                organizationId: request.organizationId,
                error,
            });
            throw error;
        }
    }
    async aggregateOrganizationData(request) {
        const organizationId = request.organizationId;
        const organization = await this.organizationRepository.findOne({
            where: { id: organizationId },
        });
        if (!organization) {
            throw new Error('Organization not found');
        }
        const members = await this.membershipRepository.find({
            where: { organizationId },
            relations: ['user'],
        });
        const ships = await this.shipRepository.find({
            where: { organizationId },
        });
        const fleetRepo = data_source_1.AppDataSource.getRepository(Fleet_1.Fleet);
        let fleets = [];
        try {
            fleets = await fleetRepo.find({
                where: { organizationId },
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch fleets', { error });
        }
        const teamMemberRepo = data_source_1.AppDataSource.getRepository(TeamMember_1.TeamMember);
        let teamMembers = [];
        try {
            teamMembers = await teamMemberRepo.find({
                where: { organizationId },
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch team members', { error });
        }
        const tradingRouteRepo = data_source_1.AppDataSource.getRepository(TradingRoute_1.TradingRoute);
        let tradingRoutes = [];
        try {
            tradingRoutes = await tradingRouteRepo.find({
                where: { organizationId },
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch trading routes', { error });
        }
        const orgInventoryRepo = data_source_1.AppDataSource.getRepository(OrganizationInventory_1.OrganizationInventory);
        let organizationInventory = [];
        try {
            organizationInventory = await orgInventoryRepo.find({
                where: { organizationId },
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch organization inventory', { error });
        }
        const fleetInventoryRepo = data_source_1.AppDataSource.getRepository(FleetInventory_1.FleetInventory);
        let fleetInventory = [];
        try {
            fleetInventory = await fleetInventoryRepo.find({
                where: { organizationId },
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch fleet inventory', { error });
        }
        const activityRepo = data_source_1.AppDataSource.getRepository(OrganizationActivity_1.OrganizationActivity);
        let activities = [];
        try {
            activities = await activityRepo.find({
                where: { organizationId },
                order: { timestamp: 'DESC' },
                take: 1000,
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch activities', { error });
        }
        const relationshipRepo = data_source_1.AppDataSource.getRepository(OrganizationRelationship_1.OrganizationRelationship);
        let relationships = [];
        try {
            relationships = await relationshipRepo.find({
                where: [{ organizationId }, { targetOrganizationId: organizationId }],
            });
        }
        catch (error) {
            logger_1.logger.warn('Could not fetch relationships', { error });
        }
        let descendants = [];
        if (request.deleteDescendants) {
            try {
                descendants = await this.hierarchyService.getDescendants(organizationId);
            }
            catch (error) {
                logger_1.logger.warn('Could not fetch descendants', { error });
            }
        }
        const exportData = {
            exportMetadata: {
                exportDate: new Date().toISOString(),
                requestId: request.id,
                organizationId: organization.id,
                organizationName: organization.name,
                exportVersion: '2.0',
            },
            organization: {
                id: organization.id,
                name: organization.name,
                description: organization.description,
                type: organization.type,
                status: organization.status,
                settings: organization.settings,
                createdAt: organization.createdAt?.toISOString(),
                updatedAt: organization.updatedAt?.toISOString(),
            },
            members: members.map(m => ({
                userId: m.userId,
                role: (0, roleUtils_1.getRoleName)(m.role) || 'member',
                title: m.title,
                joinedAt: m.joinedAt?.toISOString(),
                permissions: m.permissions,
                isActive: m.isActive,
            })),
            ships: ships.map(s => ({
                id: s.id,
                shipName: s.shipName,
                customName: s.customName,
                role: s.role,
                status: s.status,
                assignedCaptain: s.assignedCaptain,
                assignedCrew: s.assignedCrew,
                location: s.location,
                createdAt: s.createdAt?.toISOString(),
            })),
            fleets: fleets.map(f => ({
                id: f.id,
                name: f.name,
                description: f.description,
                status: f.status,
                type: f.type,
                leaderId: f.leaderId,
                secondInCommandId: f.secondInCommandId,
                members: f.members,
                shipIds: f.shipIds,
                maxMembers: f.maxMembers,
                isPublic: f.isPublic,
                allowApplications: f.allowApplications,
                composition: f.composition,
                operationalStats: f.operationalStats,
                primaryActivity: f.primaryActivity,
                deployedAt: f.deployedAt?.toISOString(),
                deploymentLocation: f.deploymentLocation,
                color: f.color,
                tags: f.tags,
                createdAt: f.createdAt?.toISOString(),
                updatedAt: f.updatedAt?.toISOString(),
            })),
            teamMembers: teamMembers.map(tm => ({
                id: tm.id,
                userId: tm.userId,
                teamId: tm.teamId,
                rank: tm.rank,
                role: tm.role,
                shipType: tm.shipType,
                status: tm.status,
                specialization: tm.specialization,
                joinedAt: tm.joinedAt?.toISOString(),
                lastActiveAt: tm.lastActiveAt?.toISOString(),
                stats: tm.stats,
                additionalRoles: tm.additionalRoles,
                certifications: tm.certifications,
                createdAt: tm.createdAt?.toISOString(),
                updatedAt: tm.updatedAt?.toISOString(),
            })),
            tradingRoutes: tradingRoutes.map(tr => ({
                id: tr.id,
                name: tr.name,
                description: tr.description,
                creatorId: tr.creatorId,
                visibility: tr.visibility,
                stops: tr.stops,
                estimatedProfit: tr.estimatedProfit,
                estimatedDuration: tr.estimatedDuration,
                minCargoCapacity: tr.minCargoCapacity,
                fleetComposition: tr.fleetComposition,
                status: tr.status,
                performance: tr.performance,
                tags: tr.tags,
                notes: tr.notes,
                createdAt: tr.createdAt?.toISOString(),
                updatedAt: tr.updatedAt?.toISOString(),
            })),
            organizationInventory: organizationInventory.map(oi => ({
                id: oi.id,
                itemName: oi.itemName,
                description: oi.description,
                category: oi.category,
                quantity: oi.quantity,
                unit: oi.unit,
                unitValue: oi.unitValue !== null && oi.unitValue !== undefined ? Number(oi.unitValue) : 0,
                totalValue: oi.totalValue !== null && oi.totalValue !== undefined ? Number(oi.totalValue) : 0,
                notes: oi.notes,
                location: oi.location,
                assignedTo: oi.assignedTo,
                createdAt: oi.createdAt?.toISOString(),
                updatedAt: oi.updatedAt?.toISOString(),
            })),
            fleetInventory: fleetInventory.map(fi => ({
                id: fi.id,
                fleetId: fi.fleetId,
                itemName: fi.itemName,
                description: fi.description,
                category: fi.category,
                quantity: fi.quantity !== null && fi.quantity !== undefined ? Number(fi.quantity) : 0,
                unit: fi.unit,
                thresholds: fi.thresholds,
                status: fi.status,
                location: fi.location,
                unitCost: fi.unitCost !== null && fi.unitCost !== undefined ? Number(fi.unitCost) : undefined,
                totalValue: fi.totalValue !== null && fi.totalValue !== undefined ? Number(fi.totalValue) : undefined,
                supplierId: fi.supplierId,
                supplierName: fi.supplierName,
                alertEnabled: fi.alertEnabled,
                lastRestockDate: fi.lastRestockDate?.toISOString(),
                nextRestockDate: fi.nextRestockDate?.toISOString(),
                averageConsumptionRate: fi.averageConsumptionRate !== null && fi.averageConsumptionRate !== undefined
                    ? Number(fi.averageConsumptionRate)
                    : undefined,
                estimatedDaysRemaining: fi.estimatedDaysRemaining,
                notes: fi.notes,
                managerId: fi.managerId,
                createdAt: fi.createdAt?.toISOString(),
                updatedAt: fi.updatedAt?.toISOString(),
            })),
            activities: activities.map(a => ({
                action: a.action,
                actorId: a.actorId,
                description: a.description,
                timestamp: a.timestamp?.toISOString() || new Date().toISOString(),
                severity: a.severity,
                metadata: a.metadata,
            })),
            relationships: relationships.map(r => ({
                relatedOrgId: r.targetOrganizationId || r.organizationId,
                relationshipType: r.type,
                status: r.status,
                trustScore: r.trustScore,
                createdAt: r.createdAt?.toISOString(),
            })),
            settings: organization.settings || {},
            descendants: request.deleteDescendants
                ? descendants.map(d => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    parentOrgId: d.parentOrgId,
                }))
                : undefined,
        };
        return exportData;
    }
    encryptData(data) {
        const iv = crypto_1.default.randomBytes(16);
        const cipher = crypto_1.default.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);
        const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return {
            encryptedData: encrypted,
            iv,
            authTag,
        };
    }
    async uploadExportToBlob(organizationId, requestId, encryptedData, metadata) {
        if (!this.blobService.isConfigured()) {
            throw new Error('Azure Blob Storage is not configured. Cannot store export file.');
        }
        const timestamp = Date.now();
        const fileName = `exports/org-${organizationId}-${requestId}-${timestamp}.json.enc`;
        const metadataJson = JSON.stringify(metadata);
        const metadataBuffer = Buffer.from(metadataJson);
        const metadataLengthBuffer = Buffer.alloc(4);
        metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);
        const combinedBuffer = Buffer.concat([metadataLengthBuffer, metadataBuffer, encryptedData]);
        const url = await this.blobService.uploadImage(fileName, combinedBuffer, 'application/octet-stream');
        logger_1.logger.info('Export file uploaded to blob storage', {
            fileName,
            url,
            size: combinedBuffer.length,
        });
        return fileName;
    }
    async generateSasToken(blobName, expirationDays = 7) {
        try {
            const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
            const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
            const containerName = process.env.AZURE_STORAGE_CONTAINER || 'images';
            if (!storageAccountKey) {
                logger_1.logger.info('Using Managed Identity - returning blob path without SAS token');
                return blobName;
            }
            const sharedKeyCredential = new storage_blob_1.StorageSharedKeyCredential(storageAccountName, storageAccountKey);
            const expiresOn = new Date();
            expiresOn.setDate(expiresOn.getDate() + expirationDays);
            const sasToken = (0, storage_blob_1.generateBlobSASQueryParameters)({
                containerName,
                blobName,
                permissions: storage_blob_1.BlobSASPermissions.parse('r'),
                startsOn: new Date(),
                expiresOn,
            }, sharedKeyCredential).toString();
            const downloadUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
            logger_1.logger.info('SAS token generated', {
                blobName,
                expiresOn: expiresOn.toISOString(),
            });
            return downloadUrl;
        }
        catch (error) {
            logger_1.logger.error('Failed to generate SAS token', { error });
            return blobName;
        }
    }
    async sendExportNotificationEmail(request, downloadToken) {
        if (!email_1.emailService.isConfigured()) {
            logger_1.logger.warn('Email not configured. Skipping notification email.');
            return;
        }
        try {
            const userRepo = data_source_1.AppDataSource.getRepository(User_1.User);
            const requester = await userRepo.findOne({
                where: { id: request.requestedBy },
            });
            if (!requester?.email) {
                logger_1.logger.warn('Requester email not found. Cannot send notification.', {
                    requestId: request.id,
                });
                return;
            }
            const emailContent = this.buildExportEmailContent(request, downloadToken);
            await email_1.emailService.send({
                to: requester.email,
                subject: `Organization Data Export Ready - ${request.organization?.name || 'Organization'}`,
                text: emailContent.text,
                html: emailContent.html,
            });
            logger_1.logger.info('Export notification email sent', {
                requestId: request.id,
                recipientEmail: requester.email,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send export notification email', {
                requestId: request.id,
                error,
            });
        }
    }
    buildExportEmailContent(request, downloadToken) {
        const orgName = request.organization?.name || 'your organization';
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        const text = `
Organization Data Export Ready

Hello,

Your data export for ${orgName} is now ready for download.

Export Details:
- Organization: ${orgName}
- Request ID: ${request.id}
- Generated: ${new Date().toISOString()}
- Expires: ${expirationDate.toISOString()}

Download Link:
${downloadToken}

Important Notes:
- This link will expire in 7 days
- The export file is encrypted for security
- Please download and store the file securely
- Contact support if you have any questions

Best regards,
SC Fleet Manager Team
        `.trim();
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #007bff; }
        .download-button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 15px 0; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Organization Data Export Ready</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Your data export for <strong>${orgName}</strong> is now ready for download.</p>
            
            <div class="details">
                <h3>Export Details</h3>
                <ul>
                    <li><strong>Organization:</strong> ${orgName}</li>
                    <li><strong>Request ID:</strong> ${request.id}</li>
                    <li><strong>Generated:</strong> ${new Date().toLocaleString()}</li>
                    <li><strong>Expires:</strong> ${expirationDate.toLocaleString()}</li>
                </ul>
            </div>

            <div style="text-align: center;">
                <a href="${downloadToken}" class="download-button">Download Export File</a>
            </div>

            <div class="warning">
                <h4>⚠️ Important Notes:</h4>
                <ul>
                    <li>This link will expire in 7 days</li>
                    <li>The export file is encrypted for security</li>
                    <li>Please download and store the file securely</li>
                    <li>Contact support if you have any questions</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>This is an automated message from SC Fleet Manager</p>
            <p>Please do not reply to this email</p>
        </div>
    </div>
</body>
</html>
        `.trim();
        return { text, html };
    }
    async getPendingRequests() {
        return this.deletionRequestRepository.find({
            where: { status: OrganizationDeletionRequest_1.OrgDeletionRequestStatus.PENDING },
            relations: ['organization', 'requester'],
            order: { requestedAt: 'ASC' },
        });
    }
    async getRequestsReadyForExecution() {
        const now = new Date();
        return this.deletionRequestRepository
            .createQueryBuilder('request')
            .where('request.status = :status', { status: OrganizationDeletionRequest_1.OrgDeletionRequestStatus.APPROVED })
            .andWhere('request.scheduledFor <= :now', { now })
            .leftJoinAndSelect('request.organization', 'organization')
            .getMany();
    }
    async getRequestById(requestId) {
        return this.deletionRequestRepository.findOne({
            where: { id: requestId },
            relations: ['organization', 'requester', 'approver', 'rejector', 'canceller'],
        });
    }
    async getRequestsForOrganization(organizationId) {
        return this.deletionRequestRepository.find({
            where: { organizationId },
            relations: ['requester', 'approver', 'rejector', 'canceller'],
            order: { requestedAt: 'DESC' },
        });
    }
    async trackExportDownload(requestId) {
        const request = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
        });
        if (!request) {
            throw new Error('Deletion request not found');
        }
        if (!request.dataExportGenerated || !request.exportFilePath) {
            throw new Error('No export available for this request');
        }
        request.exportDownloadCount = (request.exportDownloadCount || 0) + 1;
        request.exportLastDownloadedAt = new Date();
        await this.deletionRequestRepository.save(request);
        logger_1.logger.info('Export download tracked', {
            requestId: request.id,
            downloadCount: request.exportDownloadCount,
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.DATA_ACCESS,
            action: 'DATA_EXPORT_DOWNLOADED',
            message: `Organization data export downloaded`,
            userId: request.requestedBy,
            organizationId: request.organizationId,
            resource: `organization/${request.organizationId}/export`,
            metadata: {
                requestId: request.id,
                downloadCount: request.exportDownloadCount,
            },
        });
    }
    async sendEmailVerification(requestId) {
        const request = await this.deletionRequestRepository.findOne({
            where: { id: requestId },
            relations: ['organization', 'requester'],
        });
        if (!request) {
            throw new Error('Deletion request not found');
        }
        if (!request.emailVerificationToken) {
            throw new Error('Email verification token not found');
        }
        if (request.emailVerifiedAt) {
            throw new Error('Email already verified');
        }
        const requester = await this.userRepository.findOne({
            where: { id: request.requestedBy },
        });
        if (!requester?.email) {
            throw new Error('User email not found');
        }
        if (!email_1.emailService.isConfigured()) {
            logger_1.logger.warn('Email not configured. Cannot send verification email.');
            return;
        }
        const baseUrl = process.env.FRONTEND_URL;
        if (!baseUrl) {
            const errorMsg = 'FRONTEND_URL environment variable is not configured';
            logger_1.logger.error(errorMsg);
            if (process.env.NODE_ENV === 'production') {
                throw new Error(`${errorMsg} - required for email verification links`);
            }
            logger_1.logger.warn('Using default localhost URL for development');
        }
        const verificationUrl = `${baseUrl || 'http://localhost:3000'}/verify-deletion?token=${request.emailVerificationToken}`;
        const emailContent = this.buildVerificationEmailContent(request.organization?.name || 'Organization', verificationUrl);
        try {
            await email_1.emailService.send({
                to: requester.email,
                subject: `Confirm Organization Deletion - ${request.organization?.name || 'Organization'}`,
                text: emailContent.text,
                html: emailContent.html,
            });
            logger_1.logger.info('Deletion verification email sent', {
                requestId: request.id,
                recipientEmail: requester.email,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send verification email', {
                requestId: request.id,
                error,
            });
            throw error;
        }
    }
    async verifyEmailConfirmation(token) {
        const request = await this.deletionRequestRepository.findOne({
            where: { emailVerificationToken: token },
            relations: ['organization'],
        });
        if (!request) {
            throw new Error('Invalid verification token');
        }
        if (request.emailVerifiedAt) {
            throw new Error('Email already verified');
        }
        request.emailVerifiedAt = new Date();
        request.status = OrganizationDeletionRequest_1.OrgDeletionRequestStatus.PENDING;
        const savedRequest = await this.deletionRequestRepository.save(request);
        await this.activityService.logActivity({
            organizationId: request.organizationId,
            actorId: request.requestedBy,
            actorType: 'user',
            action: OrganizationActivity_1.OrgActivityAction.ORG_DELETED,
            description: `Deletion request email verified`,
            severity: OrganizationActivity_1.ActivitySeverity.INFO,
            metadata: {
                requestId: savedRequest.id,
            },
        });
        AuditService_1.auditService.log({
            category: AuditService_1.AuditCategory.ORGANIZATION,
            action: 'ORG_DELETION_EMAIL_VERIFIED',
            message: `Organization deletion email verified: ${request.organization?.name}`,
            userId: request.requestedBy,
            organizationId: request.organizationId,
            resource: `organization/${request.organizationId}/deletion`,
            metadata: {
                requestId: savedRequest.id,
            },
        });
        logger_1.logger.info('Deletion request email verified', {
            requestId: savedRequest.id,
        });
        return savedRequest;
    }
    buildVerificationEmailContent(orgName, verificationUrl) {
        const text = `
Organization Deletion Email Verification

Hello,

You have requested to delete the organization "${orgName}".

To proceed with this deletion request, please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you did not request this deletion, please ignore this email and contact support immediately.

After email verification, your request will be submitted for admin approval. Once approved, 
there will be a 30-day grace period during which you can cancel the deletion.

Best regards,
SC Fleet Manager Team
        `.trim();
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #ff4444; color: white !important; text-decoration: none; border-radius: 4px; margin: 15px 0; font-weight: bold; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Email Verification Required</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>You have requested to delete the organization <strong>"${orgName}"</strong>.</p>
            
            <p>To proceed with this deletion request, please verify your email address by clicking the button below:</p>

            <div style="text-align: center;">
                <a href="${verificationUrl}" class="button">Verify Email & Confirm Deletion</a>
            </div>

            <p style="font-size: 12px; color: #666;">Or copy and paste this link: ${verificationUrl}</p>

            <div class="warning">
                <h4>⚠️ Important:</h4>
                <ul>
                    <li>This link will expire in 24 hours</li>
                    <li>If you did not request this deletion, ignore this email and contact support</li>
                    <li>After verification, your request will be submitted for admin approval</li>
                    <li>Once approved, you will have a 30-day grace period to cancel</li>
                </ul>
            </div>

            <h4>What happens next?</h4>
            <ol>
                <li>Click the verification link above</li>
                <li>Your request will be submitted for admin review</li>
                <li>If approved, a 30-day grace period begins</li>
                <li>You can cancel anytime during the grace period</li>
            </ol>
        </div>
        <div class="footer">
            <p>This is an automated message from SC Fleet Manager</p>
            <p>Please do not reply to this email</p>
        </div>
    </div>
</body>
</html>
        `.trim();
        return { text, html };
    }
}
exports.OrganizationDeletionService = OrganizationDeletionService;
//# sourceMappingURL=OrganizationDeletionService.js.map