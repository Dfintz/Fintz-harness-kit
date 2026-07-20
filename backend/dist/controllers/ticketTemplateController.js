"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketTemplateController = void 0;
const Ticket_1 = require("../models/Ticket");
const TicketService_1 = require("../services/communication/tickets/TicketService");
const TicketTemplateService_1 = require("../services/communication/tickets/TicketTemplateService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
class TicketTemplateController extends BaseController_1.BaseController {
    getTemplateService() {
        return TicketTemplateService_1.TicketTemplateService.getInstance();
    }
    listTemplates = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const templateService = this.getTemplateService();
            const { category, search } = req.query;
            if (search) {
                return templateService.searchTemplates(search);
            }
            if (category) {
                return templateService.getTemplatesByCategory(category);
            }
            return templateService.getTemplates();
        });
    };
    getTemplate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const template = this.getTemplateService().getTemplate(id);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Ticket template');
            }
            return template;
        });
    };
    createFromTemplate = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const organizationId = this.getOrganizationId(req);
            const { id } = req.params;
            const { fieldValues, overridePriority, additionalTags } = req.body;
            const template = this.getTemplateService().getTemplate(id);
            if (!template) {
                throw new apiErrors_1.NotFoundError('Ticket template');
            }
            const ticketData = this.getTemplateService().createFromTemplate({
                templateId: id,
                creatorId: user.id,
                creatorName: user.username || user.id,
                fieldValues: fieldValues || {},
                overridePriority,
                additionalTags,
            });
            const ticketService = TicketService_1.TicketService.getInstance();
            const ticket = await ticketService.createTicket(organizationId, {
                subject: ticketData.subject,
                description: ticketData.description,
                category: ticketData.category,
                priority: ticketData.priority,
                recipientType: Ticket_1.TicketRecipientType.PLATFORM_ADMIN,
                creatorId: user.id,
                creatorName: user.username || user.id,
                tags: ticketData.tags,
            });
            logger_1.logger.info('Ticket created from template', {
                ticketId: ticket.id,
                templateId: id,
                userId: user.id,
            });
            this.sendSuccess(res, ticket, 201);
        });
    };
}
exports.TicketTemplateController = TicketTemplateController;
//# sourceMappingURL=ticketTemplateController.js.map