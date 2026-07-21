import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { OrganizationDeletionRequest } from '../../models/OrganizationDeletionRequest';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { User } from '../../models/User';
import { logger } from '../../utils/logger';
import { getRoleName } from '../../utils/roleUtils';
import { sendUserNotification } from '../../websocket/controllers/notificationWebSocketController';
import { emailService } from '../communication/email';

/**
 * Notification types for organization deletion workflow
 */
export enum OrgDeletionNotificationType {
  REQUEST_CREATED = 'deletion_request_created',
  REQUEST_APPROVED = 'deletion_request_approved',
  REQUEST_REJECTED = 'deletion_request_rejected',
  REQUEST_CANCELLED = 'deletion_request_cancelled',
  GRACE_PERIOD_REMINDER = 'grace_period_reminder',
  FINAL_WARNING = 'final_warning',
  DELETION_COMPLETED = 'deletion_completed',
}

/**
 * Organization Deletion Notification Service
 *
 * Handles all notifications for the organization deletion workflow:
 * - Email notifications to stakeholders
 * - In-app (WebSocket) notifications for real-time updates
 * - Grace period reminders
 * - Final warnings before deletion
 */
export class OrganizationDeletionNotificationService {
  private userRepository: Repository<User>;
  private membershipRepository: Repository<OrganizationMembership>;
  private deletionRequestRepository: Repository<OrganizationDeletionRequest>;

  constructor() {
    this.userRepository = AppDataSource.getRepository(User);
    this.membershipRepository = AppDataSource.getRepository(OrganizationMembership);
    this.deletionRequestRepository = AppDataSource.getRepository(OrganizationDeletionRequest);
  }

  /**
   * Send notification for deletion request creation
   */
  async notifyRequestCreated(request: OrganizationDeletionRequest): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const requester = await this.getUserById(request.requestedBy);

      // Get organization admins and members
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      // Send email notifications
      await this.sendEmailNotifications(
        stakeholders,
        `Organization Deletion Request Created - ${orgName}`,
        this.buildRequestCreatedEmailContent(request, orgName, requester?.username),
        OrgDeletionNotificationType.REQUEST_CREATED
      );

      // Send in-app notifications
      this.sendInAppNotifications(stakeholders, {
        type: 'warning',
        title: 'Deletion Request Created',
        message: `A deletion request has been created for ${orgName}. Awaiting admin approval.`,
        category: 'organization',
        data: {
          requestId: request.id,
          organizationId: request.organizationId,
          status: request.status,
          gracePeriodDays: request.gracePeriodDays,
        },
        actionUrl: `/organizations/${request.organizationId}/deletion/${request.id}`,
      });

      logger.info('Deletion request created notifications sent', {
        requestId: request.id,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send request created notifications', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Send notification for deletion request approval
   */
  async notifyRequestApproved(request: OrganizationDeletionRequest): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const approver = await this.getUserById(request.approvedBy!);
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      const daysRemaining = this.calculateDaysRemaining(request.scheduledFor!);

      // Send email notifications
      await this.sendEmailNotifications(
        stakeholders,
        `Organization Deletion Approved - ${orgName}`,
        this.buildRequestApprovedEmailContent(request, orgName, approver?.username, daysRemaining),
        OrgDeletionNotificationType.REQUEST_APPROVED
      );

      // Send in-app notifications
      this.sendInAppNotifications(stakeholders, {
        type: 'error',
        title: 'Deletion Request Approved',
        message: `The deletion request for ${orgName} has been approved. Deletion scheduled in ${daysRemaining} days.`,
        category: 'organization',
        data: {
          requestId: request.id,
          organizationId: request.organizationId,
          status: request.status,
          scheduledFor: request.scheduledFor,
          daysRemaining,
        },
        actionUrl: `/organizations/${request.organizationId}/deletion/${request.id}`,
      });

      logger.info('Deletion request approved notifications sent', {
        requestId: request.id,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send request approved notifications', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Send notification for deletion request rejection
   */
  async notifyRequestRejected(request: OrganizationDeletionRequest): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const rejector = await this.getUserById(request.rejectedBy!);
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      // Send email notifications
      await this.sendEmailNotifications(
        stakeholders,
        `Organization Deletion Rejected - ${orgName}`,
        this.buildRequestRejectedEmailContent(request, orgName, rejector?.username),
        OrgDeletionNotificationType.REQUEST_REJECTED
      );

      // Send in-app notifications
      this.sendInAppNotifications(stakeholders, {
        type: 'success',
        title: 'Deletion Request Rejected',
        message: `The deletion request for ${orgName} has been rejected. Organization will remain active.`,
        category: 'organization',
        data: {
          requestId: request.id,
          organizationId: request.organizationId,
          status: request.status,
          rejectionReason: request.rejectionReason,
        },
        actionUrl: `/organizations/${request.organizationId}`,
      });

      logger.info('Deletion request rejected notifications sent', {
        requestId: request.id,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send request rejected notifications', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Send notification for deletion request cancellation
   */
  async notifyRequestCancelled(request: OrganizationDeletionRequest): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const canceller = await this.getUserById(request.cancelledBy!);
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      // Send email notifications
      await this.sendEmailNotifications(
        stakeholders,
        `Organization Deletion Cancelled - ${orgName}`,
        this.buildRequestCancelledEmailContent(request, orgName, canceller?.username),
        OrgDeletionNotificationType.REQUEST_CANCELLED
      );

      // Send in-app notifications
      this.sendInAppNotifications(stakeholders, {
        type: 'success',
        title: 'Deletion Request Cancelled',
        message: `The deletion request for ${orgName} has been cancelled. Organization will remain active.`,
        category: 'organization',
        data: {
          requestId: request.id,
          organizationId: request.organizationId,
          status: request.status,
          cancellationReason: request.cancellationReason,
        },
        actionUrl: `/organizations/${request.organizationId}`,
      });

      logger.info('Deletion request cancelled notifications sent', {
        requestId: request.id,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send request cancelled notifications', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Send grace period reminder notification
   */
  async notifyGracePeriodReminder(
    request: OrganizationDeletionRequest,
    daysRemaining: number
  ): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      // Send email notifications
      await this.sendEmailNotifications(
        stakeholders,
        `Deletion Reminder: ${daysRemaining} Days Remaining - ${orgName}`,
        this.buildGracePeriodReminderEmailContent(request, orgName, daysRemaining),
        OrgDeletionNotificationType.GRACE_PERIOD_REMINDER
      );

      // Send in-app notifications
      this.sendInAppNotifications(stakeholders, {
        type: 'warning',
        title: `Deletion in ${daysRemaining} Days`,
        message: `${orgName} will be deleted in ${daysRemaining} days. Cancel the request if you want to keep the organization.`,
        category: 'organization',
        data: {
          requestId: request.id,
          organizationId: request.organizationId,
          daysRemaining,
          scheduledFor: request.scheduledFor,
        },
        actionUrl: `/organizations/${request.organizationId}/deletion/${request.id}`,
      });

      logger.info('Grace period reminder sent', {
        requestId: request.id,
        daysRemaining,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send grace period reminder', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Send final warning notification (24 hours before deletion)
   */
  async notifyFinalWarning(request: OrganizationDeletionRequest): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      // Send email notifications with high priority
      await this.sendEmailNotifications(
        stakeholders,
        `⚠️ FINAL WARNING: Organization Deletion in 24 Hours - ${orgName}`,
        this.buildFinalWarningEmailContent(request, orgName),
        OrgDeletionNotificationType.FINAL_WARNING,
        'high'
      );

      // Send in-app notifications
      this.sendInAppNotifications(stakeholders, {
        type: 'error',
        title: '⚠️ FINAL WARNING: Deletion in 24 Hours',
        message: `${orgName} will be permanently deleted in 24 hours! This is your last chance to cancel.`,
        category: 'organization',
        data: {
          requestId: request.id,
          organizationId: request.organizationId,
          scheduledFor: request.scheduledFor,
          isFinalWarning: true,
        },
        actionUrl: `/organizations/${request.organizationId}/deletion/${request.id}`,
      });

      logger.info('Final warning notification sent', {
        requestId: request.id,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send final warning notification', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Send notification for completed deletion
   */
  async notifyDeletionCompleted(request: OrganizationDeletionRequest): Promise<void> {
    try {
      const orgName = request.organization?.name || 'Organization';
      const stakeholders = await this.getOrganizationStakeholders(request.organizationId);

      // Send email notifications
      await this.sendEmailNotifications(
        stakeholders,
        `Organization Deletion Completed - ${orgName}`,
        this.buildDeletionCompletedEmailContent(request, orgName),
        OrgDeletionNotificationType.DELETION_COMPLETED
      );

      // Send in-app notifications (to specific users, not org since it's deleted)
      for (const stakeholder of stakeholders) {
        sendUserNotification(stakeholder.userId, {
          type: 'info',
          title: 'Organization Deletion Completed',
          message: `${orgName} has been successfully deleted and archived.`,
          category: 'organization',
          data: {
            requestId: request.id,
            organizationId: request.organizationId,
            completedAt: request.completedAt,
          },
        });
      }

      logger.info('Deletion completed notifications sent', {
        requestId: request.id,
        recipientCount: stakeholders.length,
      });
    } catch (error: unknown) {
      logger.error('Failed to send deletion completed notifications', {
        requestId: request.id,
        error,
      });
    }
  }

  /**
   * Get organization stakeholders (members who should receive notifications)
   */
  private async getOrganizationStakeholders(
    organizationId: string
  ): Promise<Array<{ userId: string; email: string; role: string }>> {
    try {
      const memberships = await this.membershipRepository.find({
        where: { organizationId },
        relations: ['user'],
      });

      const stakeholders: Array<{ userId: string; email: string; role: string }> = [];

      for (const membership of memberships) {
        if (membership.user?.email) {
          // Check user notification preferences
          const preferences = await this.getUserNotificationPreferences(membership.userId);

          // Include user only if both email notifications and org deletion notifications are enabled
          if (preferences.emailNotifications && preferences.organizationDeletionNotifications) {
            stakeholders.push({
              userId: membership.userId,
              email: membership.user.email,
              role: getRoleName(membership.role),
            });
          }
        }
      }

      return stakeholders;
    } catch (error: unknown) {
      logger.error('Failed to get organization stakeholders', { organizationId, error });
      return [];
    }
  }

  /**
   * Get user by ID
   */
  private async getUserById(userId: string): Promise<User | null> {
    try {
      return await this.userRepository.findOne({ where: { id: userId } });
    } catch (error: unknown) {
      logger.error('Failed to get user', { userId, error });
      return null;
    }
  }

  /**
   * Get user notification preferences
   */
  private async getUserNotificationPreferences(userId: string): Promise<{
    emailNotifications: boolean;
    organizationDeletionNotifications: boolean;
  }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: ['preferences'],
      });

      const preferences =
        ((user as unknown as Record<string, unknown>)?.preferences as Record<string, unknown>) ||
        {};

      return {
        emailNotifications: preferences.emailNotifications !== false,
        organizationDeletionNotifications: preferences.organizationDeletionNotifications !== false,
      };
    } catch (error: unknown) {
      logger.error('Failed to get user notification preferences', { userId, error });
      return { emailNotifications: true, organizationDeletionNotifications: true };
    }
  }

  /**
   * Send email notifications to stakeholders
   */
  private async sendEmailNotifications(
    stakeholders: Array<{ userId: string; email: string; role: string }>,
    subject: string,
    content: { text: string; html: string },
    notificationType: OrgDeletionNotificationType,
    _priority: 'normal' | 'high' = 'normal'
  ): Promise<void> {
    if (!emailService.isConfigured()) {
      logger.warn('Email not configured. Skipping email notifications.');
      return;
    }

    const emailPromises = stakeholders.map(async stakeholder => {
      try {
        await emailService.send({
          to: stakeholder.email,
          subject,
          text: content.text,
          html: content.html,
        });

        logger.debug('Email notification sent', {
          userId: stakeholder.userId,
          email: stakeholder.email,
          notificationType,
        });
      } catch (error: unknown) {
        logger.error('Failed to send email notification', {
          userId: stakeholder.userId,
          email: stakeholder.email,
          notificationType,
          error,
        });
      }
    });

    await Promise.allSettled(emailPromises);
  }

  /**
   * Send in-app notifications to stakeholders
   */
  private sendInAppNotifications(
    stakeholders: Array<{ userId: string; email: string; role: string }>,
    notification: {
      type: 'info' | 'success' | 'warning' | 'error';
      title: string;
      message: string;
      category: 'organization';
      data?: Record<string, unknown>;
      actionUrl?: string;
    }
  ): void {
    for (const stakeholder of stakeholders) {
      try {
        sendUserNotification(stakeholder.userId, notification);
      } catch (error: unknown) {
        logger.error('Failed to send in-app notification', {
          userId: stakeholder.userId,
          error,
        });
      }
    }
  }

  /**
   * Calculate days remaining until deletion
   */
  private calculateDaysRemaining(scheduledFor: Date): number {
    const now = new Date();
    const timeDiff = scheduledFor.getTime() - now.getTime();
    return Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
  }

  // ==================== EMAIL CONTENT BUILDERS ====================

  private buildRequestCreatedEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string,
    requesterUsername?: string
  ): { text: string; html: string } {
    const text = `
Organization Deletion Request Created

Hello,

A deletion request has been created for ${orgName}.

Request Details:
- Request ID: ${request.id}
- Requested by: ${requesterUsername || 'Unknown'}
- Requested at: ${request.requestedAt.toLocaleString()}
- Reason: ${request.requestReason || 'No reason provided'}
- Grace Period: ${request.gracePeriodDays} days
- Delete Descendants: ${request.deleteDescendants ? 'Yes' : 'No'}

Status: Pending Admin Approval

The request is currently awaiting approval from an administrator. If approved, there will be a grace period of ${request.gracePeriodDays} days before the deletion is executed.

What happens next?
1. An administrator will review this request
2. If approved, you will receive notifications during the grace period
3. You can cancel the request during the grace period if needed

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
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #ff9800; }
        .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; margin: 15px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Deletion Request Created</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>A deletion request has been created for <strong>${orgName}</strong>.</p>
            
            <div class="details">
                <h3>Request Details</h3>
                <ul>
                    <li><strong>Request ID:</strong> ${request.id}</li>
                    <li><strong>Requested by:</strong> ${requesterUsername || 'Unknown'}</li>
                    <li><strong>Requested at:</strong> ${request.requestedAt.toLocaleString()}</li>
                    <li><strong>Reason:</strong> ${request.requestReason || 'No reason provided'}</li>
                    <li><strong>Grace Period:</strong> ${request.gracePeriodDays} days</li>
                    <li><strong>Delete Descendants:</strong> ${request.deleteDescendants ? 'Yes' : 'No'}</li>
                </ul>
            </div>

            <div class="warning">
                <h4>📋 Status: Pending Admin Approval</h4>
                <p>The request is currently awaiting approval from an administrator. If approved, there will be a grace period of ${request.gracePeriodDays} days before the deletion is executed.</p>
            </div>

            <h4>What happens next?</h4>
            <ol>
                <li>An administrator will review this request</li>
                <li>If approved, you will receive notifications during the grace period</li>
                <li>You can cancel the request during the grace period if needed</li>
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

  private buildRequestApprovedEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string,
    approverUsername?: string,
    daysRemaining?: number
  ): { text: string; html: string } {
    const text = `
Organization Deletion Request Approved

Hello,

The deletion request for ${orgName} has been APPROVED.

Request Details:
- Request ID: ${request.id}
- Approved by: ${approverUsername || 'Unknown'}
- Approved at: ${request.approvedAt?.toLocaleString()}
- Scheduled deletion: ${request.scheduledFor?.toLocaleString()}
- Days remaining: ${daysRemaining || 'Unknown'}

IMPORTANT: Grace Period

You have ${daysRemaining} days to cancel this request if you change your mind. After the grace period expires, the organization will be permanently deleted.

To cancel the deletion:
1. Log in to SC Fleet Manager
2. Go to your organization settings
3. Navigate to the deletion request page
4. Click "Cancel Deletion Request"

What will be deleted?
- Organization profile and settings
- All members and their roles
- All ships and fleet data
- All activities and relationships
${request.deleteDescendants ? '- All child organizations' : ''}

You will receive reminder notifications during the grace period.

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
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #dc3545; }
        .warning { background-color: #f8d7da; border: 1px solid #dc3545; padding: 15px; margin: 15px 0; }
        .info { background-color: #d1ecf1; border: 1px solid #0c5460; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Deletion Request Approved</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>The deletion request for <strong>${orgName}</strong> has been <strong>APPROVED</strong>.</p>
            
            <div class="details">
                <h3>Request Details</h3>
                <ul>
                    <li><strong>Request ID:</strong> ${request.id}</li>
                    <li><strong>Approved by:</strong> ${approverUsername || 'Unknown'}</li>
                    <li><strong>Approved at:</strong> ${request.approvedAt?.toLocaleString()}</li>
                    <li><strong>Scheduled deletion:</strong> ${request.scheduledFor?.toLocaleString()}</li>
                    <li><strong>Days remaining:</strong> ${daysRemaining || 'Unknown'}</li>
                </ul>
            </div>

            <div class="warning">
                <h4>⚠️ IMPORTANT: Grace Period</h4>
                <p>You have <strong>${daysRemaining} days</strong> to cancel this request if you change your mind. After the grace period expires, the organization will be permanently deleted.</p>
            </div>

            <div class="info">
                <h4>To Cancel the Deletion:</h4>
                <ol>
                    <li>Log in to SC Fleet Manager</li>
                    <li>Go to your organization settings</li>
                    <li>Navigate to the deletion request page</li>
                    <li>Click "Cancel Deletion Request"</li>
                </ol>
            </div>

            <h4>What will be deleted?</h4>
            <ul>
                <li>Organization profile and settings</li>
                <li>All members and their roles</li>
                <li>All ships and fleet data</li>
                <li>All activities and relationships</li>
                ${request.deleteDescendants ? '<li>All child organizations</li>' : ''}
            </ul>

            <p><em>You will receive reminder notifications during the grace period.</em></p>
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

  private buildRequestRejectedEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string,
    rejectorUsername?: string
  ): { text: string; html: string } {
    const text = `
Organization Deletion Request Rejected

Hello,

Good news! The deletion request for ${orgName} has been REJECTED.

Request Details:
- Request ID: ${request.id}
- Rejected by: ${rejectorUsername || 'Unknown'}
- Rejected at: ${request.rejectedAt?.toLocaleString()}
- Reason: ${request.rejectionReason || 'No reason provided'}

Your organization will remain active and no data will be deleted.

If you have any questions, please contact your organization administrator or support team.

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
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #28a745; }
        .success { background-color: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Deletion Request Rejected</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>Good news! The deletion request for <strong>${orgName}</strong> has been <strong>REJECTED</strong>.</p>
            
            <div class="details">
                <h3>Request Details</h3>
                <ul>
                    <li><strong>Request ID:</strong> ${request.id}</li>
                    <li><strong>Rejected by:</strong> ${rejectorUsername || 'Unknown'}</li>
                    <li><strong>Rejected at:</strong> ${request.rejectedAt?.toLocaleString()}</li>
                    <li><strong>Reason:</strong> ${request.rejectionReason || 'No reason provided'}</li>
                </ul>
            </div>

            <div class="success">
                <h4>✅ Your organization is safe!</h4>
                <p>Your organization will remain active and no data will be deleted.</p>
            </div>

            <p>If you have any questions, please contact your organization administrator or support team.</p>
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

  private buildRequestCancelledEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string,
    cancellerUsername?: string
  ): { text: string; html: string } {
    const text = `
Organization Deletion Request Cancelled

Hello,

The deletion request for ${orgName} has been CANCELLED.

Request Details:
- Request ID: ${request.id}
- Cancelled by: ${cancellerUsername || 'Unknown'}
- Cancelled at: ${request.cancelledAt?.toLocaleString()}
- Reason: ${request.cancellationReason || 'No reason provided'}

Your organization will remain active and no data will be deleted.

If you need to create another deletion request in the future, you can do so from your organization settings.

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
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #28a745; }
        .success { background-color: #d4edda; border: 1px solid #28a745; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ Deletion Request Cancelled</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>The deletion request for <strong>${orgName}</strong> has been <strong>CANCELLED</strong>.</p>
            
            <div class="details">
                <h3>Request Details</h3>
                <ul>
                    <li><strong>Request ID:</strong> ${request.id}</li>
                    <li><strong>Cancelled by:</strong> ${cancellerUsername || 'Unknown'}</li>
                    <li><strong>Cancelled at:</strong> ${request.cancelledAt?.toLocaleString()}</li>
                    <li><strong>Reason:</strong> ${request.cancellationReason || 'No reason provided'}</li>
                </ul>
            </div>

            <div class="success">
                <h4>✅ Your organization is safe!</h4>
                <p>Your organization will remain active and no data will be deleted.</p>
            </div>

            <p>If you need to create another deletion request in the future, you can do so from your organization settings.</p>
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

  private buildGracePeriodReminderEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string,
    daysRemaining: number
  ): { text: string; html: string } {
    const text = `
Deletion Reminder: ${daysRemaining} Days Remaining

Hello,

This is a reminder that ${orgName} is scheduled for deletion.

Days remaining: ${daysRemaining}
Scheduled deletion: ${request.scheduledFor?.toLocaleString()}

You can still cancel this deletion request if you change your mind. To cancel:
1. Log in to SC Fleet Manager
2. Go to your organization settings
3. Navigate to the deletion request page
4. Click "Cancel Deletion Request"

After the grace period expires, the organization and all its data will be permanently deleted.

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
        .countdown { background-color: #fff3cd; border: 2px solid #ff9800; padding: 20px; margin: 15px 0; text-align: center; font-size: 24px; font-weight: bold; }
        .warning { background-color: #f8d7da; border: 1px solid #dc3545; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⏰ Deletion Reminder</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>This is a reminder that <strong>${orgName}</strong> is scheduled for deletion.</p>
            
            <div class="countdown">
                ${daysRemaining} Days Remaining
            </div>

            <div class="warning">
                <h4>Scheduled deletion: ${request.scheduledFor?.toLocaleString()}</h4>
                <p>You can still cancel this deletion request if you change your mind.</p>
            </div>

            <h4>To Cancel:</h4>
            <ol>
                <li>Log in to SC Fleet Manager</li>
                <li>Go to your organization settings</li>
                <li>Navigate to the deletion request page</li>
                <li>Click "Cancel Deletion Request"</li>
            </ol>

            <p><strong>After the grace period expires, the organization and all its data will be permanently deleted.</strong></p>
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

  private buildFinalWarningEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string
  ): { text: string; html: string } {
    const text = `
⚠️ FINAL WARNING: Organization Deletion in 24 Hours

Hello,

This is your FINAL WARNING that ${orgName} will be deleted in 24 HOURS.

Scheduled deletion: ${request.scheduledFor?.toLocaleString()}

THIS IS YOUR LAST CHANCE TO CANCEL!

If you want to keep your organization, you MUST cancel the deletion request NOW:
1. Log in to SC Fleet Manager immediately
2. Go to your organization settings
3. Navigate to the deletion request page
4. Click "Cancel Deletion Request"

After 24 hours, the organization and ALL its data will be PERMANENTLY DELETED and CANNOT be recovered.

What will be deleted:
- Organization profile and settings
- All members and their roles
- All ships and fleet data
- All activities and relationships
${request.deleteDescendants ? '- All child organizations' : ''}

DO NOT ignore this message if you want to keep your organization!

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
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .urgent { background-color: #dc3545; color: white; padding: 20px; margin: 15px 0; text-align: center; font-size: 28px; font-weight: bold; border: 4px solid #721c24; }
        .critical { background-color: #f8d7da; border: 3px solid #dc3545; padding: 20px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ FINAL WARNING</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            
            <div class="urgent">
                DELETION IN 24 HOURS
            </div>

            <div class="critical">
                <h3>⚠️ THIS IS YOUR LAST CHANCE TO CANCEL!</h3>
                <p><strong>${orgName}</strong> will be deleted in 24 HOURS.</p>
                <p><strong>Scheduled deletion:</strong> ${request.scheduledFor?.toLocaleString()}</p>
            </div>

            <h4>To Cancel the Deletion RIGHT NOW:</h4>
            <ol style="font-weight: bold;">
                <li>Log in to SC Fleet Manager immediately</li>
                <li>Go to your organization settings</li>
                <li>Navigate to the deletion request page</li>
                <li>Click "Cancel Deletion Request"</li>
            </ol>

            <p style="color: #dc3545; font-weight: bold; font-size: 16px;">After 24 hours, the organization and ALL its data will be PERMANENTLY DELETED and CANNOT be recovered.</p>

            <h4>What will be deleted:</h4>
            <ul>
                <li>Organization profile and settings</li>
                <li>All members and their roles</li>
                <li>All ships and fleet data</li>
                <li>All activities and relationships</li>
                ${request.deleteDescendants ? '<li>All child organizations</li>' : ''}
            </ul>

            <p style="color: #dc3545; font-weight: bold;">DO NOT ignore this message if you want to keep your organization!</p>
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

  private buildDeletionCompletedEmailContent(
    request: OrganizationDeletionRequest,
    orgName: string
  ): { text: string; html: string } {
    const text = `
Organization Deletion Completed

Hello,

The deletion of ${orgName} has been completed successfully.

Request Details:
- Request ID: ${request.id}
- Completed at: ${request.completedAt?.toLocaleString()}

All organization data has been archived and is no longer accessible. If you need to recover any data, please contact support immediately with the request ID above.

Thank you for using SC Fleet Manager.

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
        .header { background-color: #6c757d; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #6c757d; }
        .info { background-color: #d1ecf1; border: 1px solid #0c5460; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Organization Deletion Completed</h1>
        </div>
        <div class="content">
            <p>Hello,</p>
            <p>The deletion of <strong>${orgName}</strong> has been completed successfully.</p>
            
            <div class="details">
                <h3>Request Details</h3>
                <ul>
                    <li><strong>Request ID:</strong> ${request.id}</li>
                    <li><strong>Completed at:</strong> ${request.completedAt?.toLocaleString()}</li>
                </ul>
            </div>

            <div class="info">
                <h4>ℹ️ Data Archive</h4>
                <p>All organization data has been archived and is no longer accessible. If you need to recover any data, please contact support immediately with the request ID above.</p>
            </div>

            <p>Thank you for using SC Fleet Manager.</p>
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

