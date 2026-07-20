"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const ticketController_1 = require("../../controllers/ticketController");
const botOrUserAuth_1 = require("../../middleware/botOrUserAuth");
const schemaValidation_1 = require("../../middleware/schemaValidation");
const schemas_1 = require("../../schemas");
const router = (0, express_1.Router)();
exports.router = router;
router.use(botOrUserAuth_1.botOrUserAuth);
let ticketController;
const getController = () => {
    if (!ticketController) {
        ticketController = new ticketController_1.TicketController();
    }
    return ticketController;
};
router.get('/stats', (req, res) => getController().getStats(req, res));
router.get('/routing/stats', (req, res) => getController().getRoutingStats(req, res));
router.get('/routing/rules', (req, res) => getController().getRoutingRules(req, res));
router.post('/routing/rules', (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.createRoutingRule, 'body'), (req, res) => getController().createRoutingRule(req, res));
router.patch('/routing/rules/:ruleId', (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.routingRuleIdParam, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.updateRoutingRule, 'body'), (req, res) => getController().updateRoutingRule(req, res));
router.delete('/routing/rules/:ruleId', (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.routingRuleIdParam, 'params'), (req, res) => getController().deleteRoutingRule(req, res));
router.post('/routing/test', (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.testRoutingRule, 'body'), (req, res) => getController().testRoutingRule(req, res));
router.get('/by-number/:ticketNumber', (req, res) => getController().getTicketByNumber(req, res));
router.get('/', (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.query, 'query'), (req, res) => getController().listTickets(req, res));
router.post('/', (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.create, 'body'), (req, res) => getController().createTicket(req, res));
router.get('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().getTicket(req, res));
router.put('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.update, 'body'), (req, res) => getController().updateTicket(req, res));
router.delete('/:id', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().deleteTicket(req, res));
router.post('/:id/messages', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.addMessage, 'body'), (req, res) => getController().addMessage(req, res));
router.put('/:id/assign', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.assign, 'body'), (req, res) => getController().assignTicket(req, res));
router.put('/:id/resolve', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.resolve, 'body'), (req, res) => getController().resolveTicket(req, res));
router.put('/:id/close', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().closeTicket(req, res));
router.put('/:id/reopen', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (req, res) => getController().reopenTicket(req, res));
router.post('/:id/feedback', (0, schemaValidation_1.validateSchema)(schemas_1.paramSchemas.id, 'params'), (0, schemaValidation_1.validateSchema)(schemas_1.ticketSchemas.feedback, 'body'), (req, res) => getController().addFeedback(req, res));
//# sourceMappingURL=tickets.js.map