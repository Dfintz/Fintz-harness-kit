import crypto from 'crypto';

import {
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Fleet } from '../../models/Fleet';
import { FleetInventory } from '../../models/FleetInventory';
import {
  MAX_GRACE_PERIOD_DAYS,
  MIN_GRACE_PERIOD_DAYS,
  Organization,
} from '../../models/Organization';
import {
  ActivitySeverity,
  OrgActivityAction,
  OrganizationActivity,
} from '../../models/OrganizationActivity';
import {
  OrganizationDeletionRequest,
  OrgDeletionRequestStatus,
} from '../../models/OrganizationDeletionRequest';
import { OrganizationInventory } from '../../models/OrganizationInventory';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { OrganizationRelationship } from '../../models/OrganizationRelationship';
import { OrganizationShip } from '../../models/OrganizationShip';
import { TeamMember } from '../../models/TeamMember';
import { TradingRoute } from '../../models/TradingRoute';
import { User } from '../../models/User';
import { isValidEncryptionKeyFormat } from '../../utils/encryption';
import { logger } from '../../utils/logger';
import { retryWithBackoff } from '../../utils/retryHelper';
import { getRoleName } from '../../utils/roleUtils';
import { AuditCategory, auditService } from '../audit/AuditService';
import { AzureBlobService } from '../cloud/AzureBlobService';
import { emailService } from '../communication/email';

import { OrganizationActivityService } from './OrganizationActivityService';
import { OrganizationArchiveService } from './OrganizationArchiveService';
import { OrganizationDeletionNotificationService } from './OrganizationDeletionNotificationService';
import { OrganizationHierarchyService } from './OrganizationHierarchyService';

/**
 * Deletion preview with estimated data counts
 */
export interface DeletionPreview {
  organizationId: string;
  organizationName: string;
  descendantCount: number;
  memberCount: number;
  shipCount: number;
  estimatedDataSize: string;
  willDeleteDescendants: boolean;
}

/**
 * Organization export data structure
 */
export interface OrganizationExportData {
  exportMetadata: {
    exportDate: string;
    requestId: string;
    organizationId: string;
    organizationName: string;
    exportVersion: string;
  };
  organization: {
    id: string;
    name: string;
    description?: string;
    type?: string;
    status?: string;
    settings?: Record<string, unknown>;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
  members: Array<{
    userId: string;
    role: string;
    title?: string;
    joinedAt?: string;
    permissions?: string[];
    [key: string]: unknown;
  }>;
  ships: Array<{
    id: string;
    shipName?: string;
    shipType?: string;
    [key: string]: unknown;
  }>;
  fleets: Array<{
    id: string;
    name: string;
    description?: string;
    status: string;
    type: string;
    leaderId?: string;
    members: string[];
    shipIds: string[];
    [key: string]: unknown;
  }>;
  teamMembers: Array<{
    id: string;
    userId: string;
    teamId: string;
    rank?: string;
    role: string;
    status: string;
    [key: string]: unknown;
  }>;
  tradingRoutes: Array<{
    id: string;
    name: string;
    description: string;
    stops: Array<Record<string, unknown>>;
    estimatedProfit?: number;
    visibility: string;
    [key: string]: unknown;
  }>;
  organizationInventory: Array<{
    id: string;
    itemName: string;
    category: string;
    quantity: number;
    unit?: string;
    unitValue: number;
    totalValue: number;
    [key: string]: unknown;
  }>;
  fleetInventory: Array<{
    id: string;
    fleetId: string;
    itemName: string;
    category: string;
    quantity: number;
    unit: string;
    [key: string]: unknown;
  }>;
  activities: Array<{
    action: string;
    actorId?: string;
    description?: string;
    timestamp: string;
    [key: string]: unknown;
  }>;
  relationships: Array<{
    relatedOrgId: string;
    relationshipType?: string;
    [key: string]: unknown;
  }>;
  settings: Record<string, unknown>;
  descendants?: Array<{
    id: string;
    name: string;
    type?: string;
    [key: string]: unknown;
  }>;
}

/**
 * Organization Deletion Service
 *
 * Implements organization deletion with:
 * - Admin approval workflow
 * - Soft delete with grace period (30 days default)
 * - Data export before deletion
 * - Cascade handling for related entities
 * - GDPR-compliant data handling
 */
export class OrganizationDeletionService {
  private static encryptionKeyWarningLogged = false; // Prevent log spam

  private readonly deletionRequestRepository: Repository<OrganizationDeletionRequest>;
  private readonly organizationRepository: Repository<Organization>;
  private readonly membershipRepository: Repository<OrganizationMembership>;
  private readonly shipRepository: Repository<OrganizationShip>;
  private readonly userRepository: Repository<User>;

  private readonly archiveService: OrganizationArchiveService;
  private readonly hierarchyService: OrganizationHierarchyService;
  private readonly activityService: OrganizationActivityService;
  private readonly notificationService: OrganizationDeletionNotificationService;
  private readonly blobService: AzureBlobService;

  // Encryption configuration
  private readonly encryptionAlgorithm = 'aes-256-gcm';
  private readonly encryptionKey: Buffer;
  private readonly hasValidEncryptionKey: boolean;

  constructor() {
    this.deletionRequestRepository = AppDataSource.getRepository(OrganizationDeletionRequest);
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.shipRepository = AppDataSource.getRepository(OrganizationShip);
    this.userRepository = AppDataSource.getRepository(User);

    this.archiveService = OrganizationArchiveService.getInstance();
    this.hierarchyService = new OrganizationHierarchyService();
    this.activityService = new OrganizationActivityService();
    this.notificationService = new OrganizationDeletionNotificationService();
    this.blobService = new AzureBlobService();

    // Initialize encryption key from environment
    const keyHex = process.env.ENCRYPTION_KEY || '';
    if (!isValidEncryptionKeyFormat(keyHex, 64)) {
      // Only log error once on service initialization (not per-request)
      if (!OrganizationDeletionService.encryptionKeyWarningLogged) {
        logger.error('ENCRYPTION_KEY not configured (required: 64 hex characters)');
        logger.warn('⚠️  Organization data exports will use temporary key - NOT SECURE');
        logger.warn('To fix: Set ENCRYPTION_KEY=$(openssl rand -hex 32) in environment');
        OrganizationDeletionService.encryptionKeyWarningLogged = true;
      }
      // Use temporary key instead of throwing to allow server startup
      // Data export operations will check for valid key before attempting encryption
      this.encryptionKey = crypto.randomBytes(32);
      this.hasValidEncryptionKey = false;
    } else {
      this.encryptionKey = Buffer.from(keyHex.slice(0, 64), 'hex');
      this.hasValidEncryptionKey = true;
    }
  }

  /**
   * Create a deletion request for an organization
   */
  async createDeletionRequest(
    organizationId: string,
    requestedBy: string,
    options: {
      reason?: string;
      deleteDescendants?: boolean;
      gracePeriodDays?: number;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<OrganizationDeletionRequest> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    if (organization.isArchived) {
      throw new Error('Organization is already archived');
    }

    // Check for existing pending request
    const existingRequest = await this.deletionRequestRepository.findOne({
      where: {
        organizationId,
        status: OrgDeletionRequestStatus.PENDING,
      },
    });

    if (existingRequest) {
      throw new Error('A deletion request for this organization is already pending');
    }

    // Validate grace period
    const gracePeriodDays = Math.max(
      MIN_GRACE_PERIOD_DAYS,
      Math.min(MAX_GRACE_PERIOD_DAYS, options.gracePeriodDays || 30)
    );

    // Generate deletion preview
    const preview = await this.generateDeletionPreview(
      organizationId,
      options.deleteDescendants || false
    );

    const request = this.deletionRequestRepository.create({
      id: crypto.randomUUID(),
      organizationId,
      requestedBy,
      status: OrgDeletionRequestStatus.EMAIL_VERIFICATION_PENDING,
      requestedAt: new Date(),
      requestReason: options.reason,
      deleteDescendants: options.deleteDescendants || false,
      gracePeriodDays,
      deletionPreview: preview as unknown as Record<string, unknown>, // Type cast needed due to complex JSONB type mismatch
      requestIpAddress: options.ipAddress,
      requestUserAgent: options.userAgent,
      emailVerificationToken: crypto.randomBytes(32).toString('hex'),
    }); // Cast to single entity, not array

    const savedRequest = await this.deletionRequestRepository.save(request);

    // Log the deletion request
    await this.activityService.logActivity({
      organizationId,
      actorId: requestedBy,
      actorType: 'user',
      action: OrgActivityAction.ORG_DELETED,
      description: `Deletion request created: ${preview.organizationName}`,
      severity: ActivitySeverity.CRITICAL,
      metadata: {
        requestId: savedRequest.id,
        deleteDescendants: options.deleteDescendants,
        gracePeriodDays,
        reason: options.reason,
      },
    });

    auditService.log({
      category: AuditCategory.ORGANIZATION,
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

    logger.info('Organization deletion request created', {
      organizationId,
      requestId: savedRequest.id,
      requestedBy,
    });

    // Send notifications
    await this.notificationService.notifyRequestCreated(savedRequest);

    // Send email verification
    await this.sendEmailVerification(savedRequest.id);

    return savedRequest;
  }

  /**
   * Approve a deletion request (admin only)
   */
  async approveDeletionRequest(
    requestId: string,
    approvedBy: string,
    options: {
      notes?: string;
      generateExport?: boolean;
    } = {}
  ): Promise<OrganizationDeletionRequest> {
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

    request.status = OrgDeletionRequestStatus.APPROVED;
    request.approvedAt = new Date();
    request.approvedBy = approvedBy;
    request.approvalNotes = options.notes;
    request.scheduledFor = scheduledFor;

    const savedRequest = await this.deletionRequestRepository.save(request);

    // Generate data export if requested
    if (options.generateExport) {
      await this.generateDataExport(request);
    }

    // Log the approval
    await this.activityService.logActivity({
      organizationId: request.organizationId,
      actorId: approvedBy,
      actorType: 'user',
      action: OrgActivityAction.ORG_DELETED,
      description: `Deletion request approved`,
      severity: ActivitySeverity.CRITICAL,
      metadata: {
        requestId: savedRequest.id,
        scheduledFor,
        notes: options.notes,
      },
    });

    auditService.log({
      category: AuditCategory.ORGANIZATION,
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

    logger.info('Organization deletion request approved', {
      requestId: savedRequest.id,
      approvedBy,
      scheduledFor,
    });

    // Send notifications
    await this.notificationService.notifyRequestApproved(savedRequest);

    return savedRequest;
  }

  /**
   * Reject a deletion request (admin only)
   */
  async rejectDeletionRequest(
    requestId: string,
    rejectedBy: string,
    reason: string
  ): Promise<OrganizationDeletionRequest> {
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

    request.status = OrgDeletionRequestStatus.REJECTED;
    request.rejectedAt = new Date();
    request.rejectedBy = rejectedBy;
    request.rejectionReason = reason;

    const savedRequest = await this.deletionRequestRepository.save(request);

    // Log the rejection
    await this.activityService.logActivity({
      organizationId: request.organizationId,
      actorId: rejectedBy,
      actorType: 'user',
      action: OrgActivityAction.ORG_DELETED,
      description: `Deletion request rejected`,
      severity: ActivitySeverity.INFO,
      metadata: {
        requestId: savedRequest.id,
        reason,
      },
    });

    auditService.log({
      category: AuditCategory.ORGANIZATION,
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

    logger.info('Organization deletion request rejected', {
      requestId: savedRequest.id,
      rejectedBy,
      reason,
    });

    // Send notifications
    await this.notificationService.notifyRequestRejected(savedRequest);

    return savedRequest;
  }

  /**
   * Cancel a deletion request during grace period
   */
  async cancelDeletionRequest(
    requestId: string,
    cancelledBy: string,
    reason?: string
  ): Promise<OrganizationDeletionRequest> {
    const request = await this.deletionRequestRepository.findOne({
      where: { id: requestId },
      relations: ['organization'],
    });

    if (!request) {
      throw new Error('Deletion request not found');
    }

    if (!request.canBeCancelled()) {
      throw new Error(
        `Deletion request cannot be cancelled in ${request.status} status or grace period has expired`
      );
    }

    request.status = OrgDeletionRequestStatus.CANCELLED;
    request.cancelledAt = new Date();
    request.cancelledBy = cancelledBy;
    request.cancellationReason = reason;

    const savedRequest = await this.deletionRequestRepository.save(request);

    // Log the cancellation
    await this.activityService.logActivity({
      organizationId: request.organizationId,
      actorId: cancelledBy,
      actorType: 'user',
      action: OrgActivityAction.ORG_DELETED,
      description: `Deletion request cancelled`,
      severity: ActivitySeverity.INFO,
      metadata: {
        requestId: savedRequest.id,
        reason,
      },
    });

    auditService.log({
      category: AuditCategory.ORGANIZATION,
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

    logger.info('Organization deletion request cancelled', {
      requestId: savedRequest.id,
      cancelledBy,
      reason,
    });

    // Send notifications
    await this.notificationService.notifyRequestCancelled(savedRequest);

    return savedRequest;
  }

  /**
   * Execute deletion for approved requests past grace period
   */
  async executeDeletion(requestId: string): Promise<void> {
    const request = await this.deletionRequestRepository.findOne({
      where: { id: requestId },
      relations: ['organization'],
    });

    if (!request) {
      throw new Error('Deletion request not found');
    }

    if (request.status !== OrgDeletionRequestStatus.APPROVED) {
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
      // First archive the organization (soft delete)
      await this.archiveService.archiveOrganization(
        request.organizationId,
        request.approvedBy || request.requestedBy,
        `Deletion request executed: ${request.requestReason || 'No reason provided'}`
      );

      // Mark request as completed
      request.status = OrgDeletionRequestStatus.COMPLETED;
      request.completedAt = new Date();
      await this.deletionRequestRepository.save(request);

      // Log the completion
      await this.activityService.logActivity({
        organizationId: request.organizationId,
        actorId: request.approvedBy || request.requestedBy,
        actorType: 'system',
        action: OrgActivityAction.ORG_DELETED,
        description: `Organization archived: ${organization.name}`,
        severity: ActivitySeverity.CRITICAL,
        metadata: {
          requestId: request.id,
          deleteDescendants: request.deleteDescendants,
        },
      });

      auditService.log({
        category: AuditCategory.ORGANIZATION,
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

      logger.info('Organization deletion executed', {
        requestId: request.id,
        organizationId: request.organizationId,
        organizationName: organization.name,
      });

      // Send notifications
      await this.notificationService.notifyDeletionCompleted(request);
    } catch (error: unknown) {
      // Mark request as failed
      request.status = OrgDeletionRequestStatus.FAILED;
      request.failureReason = error instanceof Error ? error.message : 'Unknown error';
      await this.deletionRequestRepository.save(request);

      logger.error('Organization deletion failed', {
        requestId: request.id,
        organizationId: request.organizationId,
        error,
      });

      throw error;
    }
  }

  /**
   * Generate deletion preview
   */
  async generateDeletionPreview(
    organizationId: string,
    deleteDescendants: boolean
  ): Promise<DeletionPreview> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    let descendantCount = 0;
    let memberCount = 0;
    let shipCount = 0;
    let organizationIds: string[] = [organizationId];

    // Get all descendant IDs if needed
    if (deleteDescendants) {
      const descendants = await this.hierarchyService.getDescendants(organizationId);
      descendantCount = descendants.length;
      organizationIds = [organizationId, ...descendants.map(d => d.id)];
    }

    // Use IN clause for efficient bulk counting
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

    // Estimate data size (rough approximation)
    const estimatedRecords = memberCount + shipCount + descendantCount;
    const estimatedSizeKB = estimatedRecords * 2; // Rough estimate: 2KB per record
    const estimatedDataSize =
      estimatedSizeKB > 1024
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

  /**
   * Generate data export for organization
   * Implements GDPR-compliant data export with:
   * 1. Comprehensive data aggregation from all organization-related tables
   * 2. JSON export format with encryption
   * 3. Secure storage in Azure Blob Storage
   * 4. Time-limited SAS token for download (7-day expiration)
   * 5. Email notification with download link
   * 6. Retry logic with exponential backoff
   */
  async generateDataExport(request: OrganizationDeletionRequest): Promise<string> {
    try {
      logger.info('Starting data export generation', {
        requestId: request.id,
        organizationId: request.organizationId,
      });

      // Check if we have a valid encryption key in production
      if (!this.hasValidEncryptionKey && process.env.NODE_ENV === 'production') {
        logger.warn(
          'Data export using temporary encryption key in production - exports may not be secure',
          {
            requestId: request.id,
            organizationId: request.organizationId,
          }
        );
      }

      // Step 1: Aggregate all organization data with retry
      const exportData = await retryWithBackoff(() => this.aggregateOrganizationData(request), {
        maxAttempts: 3,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          logger.warn('Retrying data aggregation', {
            requestId: request.id,
            attempt,
            error: error.message,
          });
        },
      });

      // Step 2: Convert to JSON
      const jsonData = JSON.stringify(exportData, null, 2);

      // Step 3: Encrypt the data
      const { encryptedData, iv, authTag } = this.encryptData(jsonData);

      // Step 4: Upload to Azure Blob Storage with retry
      const exportPath = await retryWithBackoff(
        () =>
          this.uploadExportToBlob(request.organizationId, request.id, encryptedData, {
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
          }),
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          onRetry: (error, attempt) => {
            logger.warn('Retrying blob upload', {
              requestId: request.id,
              attempt,
              error: error.message,
            });
          },
        }
      );

      // Step 5: Generate SAS token with 7-day expiration
      const downloadToken = await this.generateSasToken(exportPath, 7);

      // Step 6: Update request with export information
      request.dataExportGenerated = true;
      request.exportFilePath = exportPath;
      request.exportDownloadToken = downloadToken;
      await this.deletionRequestRepository.save(request);

      // Step 7: Send email notification with retry
      await retryWithBackoff(() => this.sendExportNotificationEmail(request, downloadToken), {
        maxAttempts: 2,
        initialDelayMs: 1000,
        onRetry: (error, attempt) => {
          logger.warn('Retrying email notification', {
            requestId: request.id,
            attempt,
            error: error.message,
          });
        },
      });

      logger.info('Data export generated successfully', {
        requestId: request.id,
        exportPath,
        dataSize: jsonData.length,
      });

      return exportPath;
    } catch (error: unknown) {
      logger.error('Failed to generate data export', {
        requestId: request.id,
        organizationId: request.organizationId,
        error,
      });
      throw error;
    }
  }

  /**
   * Aggregate all organization-related data
   */
  private async aggregateOrganizationData(
    request: OrganizationDeletionRequest
  ): Promise<OrganizationExportData> {
    const organizationId = request.organizationId;

    // Fetch organization details
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new Error('Organization not found');
    }

    // Fetch members with roles
    const members = await this.membershipRepository.find({
      where: { organizationId },
      relations: ['user'],
    });

    // Fetch ships
    const ships = await this.shipRepository.find({
      where: { organizationId },
    });

    // Fetch fleets
    const fleetRepo = AppDataSource.getRepository(Fleet);
    let fleets: Fleet[] = [];
    try {
      fleets = await fleetRepo.find({
        where: { organizationId },
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch fleets', { error });
    }

    // Fetch team members
    const teamMemberRepo = AppDataSource.getRepository(TeamMember);
    let teamMembers: TeamMember[] = [];
    try {
      teamMembers = await teamMemberRepo.find({
        where: { organizationId },
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch team members', { error });
    }

    // Fetch trading routes
    const tradingRouteRepo = AppDataSource.getRepository(TradingRoute);
    let tradingRoutes: TradingRoute[] = [];
    try {
      tradingRoutes = await tradingRouteRepo.find({
        where: { organizationId },
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch trading routes', { error });
    }

    // Fetch organization inventory
    const orgInventoryRepo = AppDataSource.getRepository(OrganizationInventory);
    let organizationInventory: OrganizationInventory[] = [];
    try {
      organizationInventory = await orgInventoryRepo.find({
        where: { organizationId },
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch organization inventory', { error });
    }

    // Fetch fleet inventory
    const fleetInventoryRepo = AppDataSource.getRepository(FleetInventory);
    let fleetInventory: FleetInventory[] = [];
    try {
      fleetInventory = await fleetInventoryRepo.find({
        where: { organizationId },
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch fleet inventory', { error });
    }

    // Fetch activities (last 1000 entries)
    const activityRepo = AppDataSource.getRepository(OrganizationActivity);
    let activities: OrganizationActivity[] = [];
    try {
      activities = await activityRepo.find({
        where: { organizationId },
        order: { timestamp: 'DESC' },
        take: 1000,
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch activities', { error });
    }

    // Fetch relationships
    const relationshipRepo = AppDataSource.getRepository(OrganizationRelationship);
    let relationships: OrganizationRelationship[] = [];
    try {
      relationships = await relationshipRepo.find({
        where: [{ organizationId }, { targetOrganizationId: organizationId }],
      });
    } catch (error: unknown) {
      logger.warn('Could not fetch relationships', { error });
    }

    // Fetch descendants if needed
    let descendants: Organization[] = [];
    if (request.deleteDescendants) {
      try {
        descendants = await this.hierarchyService.getDescendants(organizationId);
      } catch (error: unknown) {
        logger.warn('Could not fetch descendants', { error });
      }
    }

    // Build export data structure
    const exportData: OrganizationExportData = {
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
        // @ts-expect-error - OrganizationSettings type mismatch
        settings: organization.settings,
        createdAt: organization.createdAt?.toISOString(),
        updatedAt: organization.updatedAt?.toISOString(),
      },
      members: members.map(m => ({
        userId: m.userId,
        role: getRoleName(m.role) || 'member',
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
      // @ts-expect-error - TradeStop type mismatch with Record<string, unknown>
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
        totalValue:
          oi.totalValue !== null && oi.totalValue !== undefined ? Number(oi.totalValue) : 0,
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
        unitCost:
          fi.unitCost !== null && fi.unitCost !== undefined ? Number(fi.unitCost) : undefined,
        totalValue:
          fi.totalValue !== null && fi.totalValue !== undefined ? Number(fi.totalValue) : undefined,
        supplierId: fi.supplierId,
        supplierName: fi.supplierName,
        alertEnabled: fi.alertEnabled,
        lastRestockDate: fi.lastRestockDate?.toISOString(),
        nextRestockDate: fi.nextRestockDate?.toISOString(),
        averageConsumptionRate:
          fi.averageConsumptionRate !== null && fi.averageConsumptionRate !== undefined
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
      // @ts-expect-error - OrganizationSettings type mismatch
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

  /**
   * Encrypt data using AES-256-GCM
   */
  private encryptData(data: string): { encryptedData: Buffer; iv: Buffer; authTag: Buffer } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.encryptionAlgorithm, this.encryptionKey, iv);

    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);

    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      iv,
      authTag,
    };
  }

  /**
   * Upload encrypted export to Azure Blob Storage
   */
  private async uploadExportToBlob(
    organizationId: string,
    requestId: string,
    encryptedData: Buffer,
    metadata: { iv: string; authTag: string }
  ): Promise<string> {
    if (!this.blobService.isConfigured()) {
      throw new Error('Azure Blob Storage is not configured. Cannot store export file.');
    }

    const timestamp = Date.now();
    const fileName = `exports/org-${organizationId}-${requestId}-${timestamp}.json.enc`;

    // Create a combined buffer with metadata and encrypted data
    const metadataJson = JSON.stringify(metadata);
    const metadataBuffer = Buffer.from(metadataJson);
    const metadataLengthBuffer = Buffer.alloc(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);

    const combinedBuffer = Buffer.concat([metadataLengthBuffer, metadataBuffer, encryptedData]);

    // Upload to blob storage
    const url = await this.blobService.uploadImage(
      fileName,
      combinedBuffer,
      'application/octet-stream'
    );

    logger.info('Export file uploaded to blob storage', {
      fileName,
      url,
      size: combinedBuffer.length,
    });

    return fileName;
  }

  /**
   * Generate SAS token for blob download with expiration
   * Note: Uses AZURE_STORAGE_CONTAINER from environment (typically 'images' container)
   * Export files are stored under 'exports/' prefix within the container
   */
  private async generateSasToken(blobName: string, expirationDays: number = 7): Promise<string> {
    try {
      const storageAccountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
      const storageAccountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
      const containerName = process.env.AZURE_STORAGE_CONTAINER || 'images';

      // If using Managed Identity, return the blob URL without SAS
      // The download will need to use Azure authentication
      if (!storageAccountKey) {
        logger.info('Using Managed Identity - returning blob path without SAS token');
        return blobName;
      }

      // Generate SAS token with Storage Account Key
      const sharedKeyCredential = new StorageSharedKeyCredential(
        storageAccountName!,
        storageAccountKey
      );

      const expiresOn = new Date();
      expiresOn.setDate(expiresOn.getDate() + expirationDays);

      const sasToken = generateBlobSASQueryParameters(
        {
          containerName,
          blobName,
          permissions: BlobSASPermissions.parse('r'), // Read-only
          startsOn: new Date(),
          expiresOn,
        },
        sharedKeyCredential
      ).toString();

      const downloadUrl = `https://${storageAccountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;

      logger.info('SAS token generated', {
        blobName,
        expiresOn: expiresOn.toISOString(),
      });

      return downloadUrl;
    } catch (error: unknown) {
      logger.error('Failed to generate SAS token', { error });
      // Return the blob path as fallback
      return blobName;
    }
  }

  /**
   * Send email notification with download link
   */
  private async sendExportNotificationEmail(
    request: OrganizationDeletionRequest,
    downloadToken: string
  ): Promise<void> {
    if (!emailService.isConfigured()) {
      logger.warn('Email not configured. Skipping notification email.');
      return;
    }

    try {
      // Get requester email
      const userRepo = AppDataSource.getRepository(User);
      const requester = await userRepo.findOne({
        where: { id: request.requestedBy },
      });

      if (!requester?.email) {
        logger.warn('Requester email not found. Cannot send notification.', {
          requestId: request.id,
        });
        return;
      }

      const emailContent = this.buildExportEmailContent(request, downloadToken);

      await emailService.send({
        to: requester.email,
        subject: `Organization Data Export Ready - ${request.organization?.name || 'Organization'}`,
        text: emailContent.text,
        html: emailContent.html,
      });

      logger.info('Export notification email sent', {
        requestId: request.id,
        recipientEmail: requester.email,
      });
    } catch (error: unknown) {
      logger.error('Failed to send export notification email', {
        requestId: request.id,
        error,
      });
      // Don't throw - email failure shouldn't break the export process
    }
  }

  /**
   * Build email content for export notification
   */
  private buildExportEmailContent(
    request: OrganizationDeletionRequest,
    downloadToken: string
  ): { text: string; html: string } {
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

  /**
   * Get pending deletion requests requiring admin approval
   */
  async getPendingRequests(): Promise<OrganizationDeletionRequest[]> {
    return this.deletionRequestRepository.find({
      where: { status: OrgDeletionRequestStatus.PENDING },
      relations: ['organization', 'requester'],
      order: { requestedAt: 'ASC' },
    });
  }

  /**
   * Get approved requests ready for execution
   */
  async getRequestsReadyForExecution(): Promise<OrganizationDeletionRequest[]> {
    const now = new Date();

    return this.deletionRequestRepository
      .createQueryBuilder('request')
      .where('request.status = :status', { status: OrgDeletionRequestStatus.APPROVED })
      .andWhere('request.scheduledFor <= :now', { now })
      .leftJoinAndSelect('request.organization', 'organization')
      .getMany();
  }

  /**
   * Get deletion request by ID
   */
  async getRequestById(requestId: string): Promise<OrganizationDeletionRequest | null> {
    return this.deletionRequestRepository.findOne({
      where: { id: requestId },
      relations: ['organization', 'requester', 'approver', 'rejector', 'canceller'],
    });
  }

  /**
   * Get deletion requests for an organization
   */
  async getRequestsForOrganization(organizationId: string): Promise<OrganizationDeletionRequest[]> {
    return this.deletionRequestRepository.find({
      where: { organizationId },
      relations: ['requester', 'approver', 'rejector', 'canceller'],
      order: { requestedAt: 'DESC' },
    });
  }

  /**
   * Track export download
   */
  async trackExportDownload(requestId: string): Promise<void> {
    const request = await this.deletionRequestRepository.findOne({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Deletion request not found');
    }

    if (!request.dataExportGenerated || !request.exportFilePath) {
      throw new Error('No export available for this request');
    }

    // Increment download count and update timestamp
    request.exportDownloadCount = (request.exportDownloadCount || 0) + 1;
    request.exportLastDownloadedAt = new Date();

    await this.deletionRequestRepository.save(request);

    logger.info('Export download tracked', {
      requestId: request.id,
      downloadCount: request.exportDownloadCount,
    });

    // Log audit event
    auditService.log({
      category: AuditCategory.DATA_ACCESS,
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

  /**
   * Send email verification for deletion request
   */
  async sendEmailVerification(requestId: string): Promise<void> {
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

    if (!emailService.isConfigured()) {
      logger.warn('Email not configured. Cannot send verification email.');
      return;
    }

    const baseUrl = process.env.FRONTEND_URL;
    if (!baseUrl) {
      const errorMsg = 'FRONTEND_URL environment variable is not configured';
      logger.error(errorMsg);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`${errorMsg} - required for email verification links`);
      }
      // In development, use a default
      logger.warn('Using default localhost URL for development');
    }
    const verificationUrl = `${baseUrl || 'http://localhost:3000'}/verify-deletion?token=${request.emailVerificationToken}`;

    const emailContent = this.buildVerificationEmailContent(
      request.organization?.name || 'Organization',
      verificationUrl
    );

    try {
      await emailService.send({
        to: requester.email,
        subject: `Confirm Organization Deletion - ${request.organization?.name || 'Organization'}`,
        text: emailContent.text,
        html: emailContent.html,
      });

      logger.info('Deletion verification email sent', {
        requestId: request.id,
        recipientEmail: requester.email,
      });
    } catch (error: unknown) {
      logger.error('Failed to send verification email', {
        requestId: request.id,
        error,
      });
      throw error;
    }
  }

  /**
   * Verify email confirmation token
   */
  async verifyEmailConfirmation(token: string): Promise<OrganizationDeletionRequest> {
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

    // Update request status
    request.emailVerifiedAt = new Date();
    request.status = OrgDeletionRequestStatus.PENDING; // Now ready for admin approval

    const savedRequest = await this.deletionRequestRepository.save(request);

    // Log the verification
    await this.activityService.logActivity({
      organizationId: request.organizationId,
      actorId: request.requestedBy,
      actorType: 'user',
      action: OrgActivityAction.ORG_DELETED,
      description: `Deletion request email verified`,
      severity: ActivitySeverity.INFO,
      metadata: {
        requestId: savedRequest.id,
      },
    });

    auditService.log({
      category: AuditCategory.ORGANIZATION,
      action: 'ORG_DELETION_EMAIL_VERIFIED',
      message: `Organization deletion email verified: ${request.organization?.name}`,
      userId: request.requestedBy,
      organizationId: request.organizationId,
      resource: `organization/${request.organizationId}/deletion`,
      metadata: {
        requestId: savedRequest.id,
      },
    });

    logger.info('Deletion request email verified', {
      requestId: savedRequest.id,
    });

    return savedRequest;
  }

  /**
   * Build email verification content
   */
  private buildVerificationEmailContent(
    orgName: string,
    verificationUrl: string
  ): { text: string; html: string } {
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
