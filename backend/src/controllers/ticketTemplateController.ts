import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { TicketCategory, TicketRecipientType } from '../models/Ticket';
import { TicketService } from '../services/communication/tickets/TicketService';
import { TicketTemplateService } from '../services/communication/tickets/TicketTemplateService';
import { NotFoundError } from '../utils/apiErrors';
import { logger } from '../utils/logger';

import { BaseController } from './BaseController';

/**
 * TicketTemplateController — Handles ticket template listing and ticket creation from templates.
 * Extends BaseController for standardized error handling.
 */
export class TicketTemplateController extends BaseController {
  private getTemplateService(): TicketTemplateService {
    return TicketTemplateService.getInstance();
  }

  /**
   * GET /api/tickets/templates
   * List all available ticket templates, optionally filtered by category.
   */
  public listTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const templateService = this.getTemplateService();
      const { category, search } = req.query;

      if (search) {
        return templateService.searchTemplates(search as string); // NOSONAR: Improper Type Validation FP — Express query params are strings
      }
      if (category) {
        return templateService.getTemplatesByCategory(category as TicketCategory);
      }
      return templateService.getTemplates();
    });
  };

  /**
   * GET /api/tickets/templates/:id
   * Get a specific ticket template by ID.
   */
  public getTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.executeAndReturn(req, res, async () => {
      const { id } = req.params;
      const template = this.getTemplateService().getTemplate(id);
      if (!template) {
        throw new NotFoundError('Ticket template');
      }
      return template;
    });
  };

  /**
   * POST /api/tickets/templates/:id/create
   * Create a ticket from a template by populating the template fields.
   */
  public createFromTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
    await this.execute(req, res, async () => {
      const user = this.getAuthUser(req);
      const organizationId = this.getOrganizationId(req);
      const { id } = req.params;
      const { fieldValues, overridePriority, additionalTags } = req.body;

      // Verify template exists
      const template = this.getTemplateService().getTemplate(id);
      if (!template) {
        throw new NotFoundError('Ticket template');
      }

      // Generate ticket data from template
      const ticketData = this.getTemplateService().createFromTemplate({
        templateId: id,
        creatorId: user.id,
        creatorName: user.username || user.id,
        fieldValues: fieldValues || {},
        overridePriority,
        additionalTags,
      });

      // Create actual ticket
      const ticketService = TicketService.getInstance();
      const ticket = await ticketService.createTicket(organizationId, {
        subject: ticketData.subject,
        description: ticketData.description,
        category: ticketData.category,
        priority: ticketData.priority,
        recipientType: TicketRecipientType.PLATFORM_ADMIN,
        creatorId: user.id,
        creatorName: user.username || user.id,
        tags: ticketData.tags,
      });

      logger.info('Ticket created from template', {
        ticketId: ticket.id,
        templateId: id,
        userId: user.id,
      });

      this.sendSuccess(res, ticket, 201);
    });
  };
}
