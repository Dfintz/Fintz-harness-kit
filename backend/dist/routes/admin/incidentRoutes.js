"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const schemaValidation_1 = require("../../middleware/schemaValidation");
const incidentSchemas_1 = require("../../schemas/incidentSchemas");
const compliance_1 = require("../../services/compliance");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const router = express_1.default.Router();
exports.router = router;
const incidentService = new compliance_1.IncidentResponseService();
function respondTypedApiError(res, error) {
    if (error instanceof apiErrors_1.ApiError) {
        res.status(error.statusCode).json({ error: error.message });
        return true;
    }
    return false;
}
router.post('/report', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.incidentSchemas.reportBreach, 'body'), async (req, res) => {
    try {
        const { title, description, severity, affectedUsers, affectedDataTypes } = req.body;
        const incident = await incidentService.reportBreach({
            title,
            description,
            severity,
            affectedUsers: affectedUsers || [],
            affectedDataTypes: affectedDataTypes || [],
        });
        logger_1.logger.info('Incident reported via API', {
            incidentId: incident.id,
            userId: req.user?.id,
        });
        res.status(201).json(incident);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to report incident', { error: errorMessage });
        res.status(500).json({ error: 'Failed to report incident' });
    }
});
router.post('/:id/notify', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.paramSchemas.incidentId, 'params'), async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await incidentService.getById(id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        await incidentService.notifyAffectedUsers(incident);
        logger_1.logger.info('Incident notifications sent via API', {
            incidentId: id,
            userId: req.user?.id,
        });
        res.json({
            message: 'Notifications sent',
            notifiedCount: incident.notifiedUsers.length,
            errorCount: incident.notificationErrors.length,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to send notifications', { error: errorMessage });
        res.status(500).json({ error: 'Failed to send notifications' });
    }
});
router.get('/:id/report', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.paramSchemas.incidentId, 'params'), async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await incidentService.getById(id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        const report = await incidentService.generateBreachReport(incident);
        logger_1.logger.info('Incident report generated via API', {
            incidentId: id,
            userId: req.user?.id,
        });
        res.setHeader('Content-Type', 'text/plain');
        res.send(report);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to generate report', { error: errorMessage });
        res.status(500).json({ error: 'Failed to generate report' });
    }
});
router.get('/', async (req, res) => {
    try {
        const incidents = await incidentService.listIncidents();
        logger_1.logger.info('Incidents listed via API', {
            count: incidents.length,
            userId: req.user?.id,
        });
        res.json(incidents);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to list incidents', { error: errorMessage });
        res.status(500).json({ error: 'Failed to list incidents' });
    }
});
router.get('/:id', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.paramSchemas.incidentId, 'params'), async (req, res) => {
    try {
        const { id } = req.params;
        const incident = await incidentService.getById(id);
        if (!incident) {
            return res.status(404).json({ error: 'Incident not found' });
        }
        logger_1.logger.info('Incident retrieved via API', {
            incidentId: id,
            userId: req.user?.id,
        });
        res.json(incident);
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to get incident', { error: errorMessage });
        res.status(500).json({ error: 'Failed to get incident' });
    }
});
router.patch('/:id/status', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.paramSchemas.incidentId, 'params'), (0, schemaValidation_1.validateSchema)(incidentSchemas_1.incidentSchemas.updateStatus, 'body'), async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const incident = await incidentService.updateStatus(id, status);
        logger_1.logger.info('Incident status updated via API', {
            incidentId: id,
            newStatus: status,
            userId: req.user?.id,
        });
        res.json(incident);
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to update incident status', { error: errorMessage });
        res.status(500).json({ error: 'Failed to update incident status' });
    }
});
router.post('/:id/remediation', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.paramSchemas.incidentId, 'params'), (0, schemaValidation_1.validateSchema)(incidentSchemas_1.incidentSchemas.addRemediationStep, 'body'), async (req, res) => {
    try {
        const { id } = req.params;
        const { step } = req.body;
        const incident = await incidentService.addRemediationStep(id, step);
        logger_1.logger.info('Remediation step added via API', {
            incidentId: id,
            userId: req.user?.id,
        });
        res.json(incident);
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to add remediation step', { error: errorMessage });
        res.status(500).json({ error: 'Failed to add remediation step' });
    }
});
router.post('/:id/recommendation', (0, schemaValidation_1.validateSchema)(incidentSchemas_1.paramSchemas.incidentId, 'params'), (0, schemaValidation_1.validateSchema)(incidentSchemas_1.incidentSchemas.addRecommendation, 'body'), async (req, res) => {
    try {
        const { id } = req.params;
        const { recommendation } = req.body;
        const incident = await incidentService.addRecommendation(id, recommendation);
        logger_1.logger.info('Recommendation added via API', {
            incidentId: id,
            userId: req.user?.id,
        });
        res.json(incident);
    }
    catch (error) {
        if (respondTypedApiError(res, error)) {
            return;
        }
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger_1.logger.error('Failed to add recommendation', { error: errorMessage });
        res.status(500).json({ error: 'Failed to add recommendation' });
    }
});
//# sourceMappingURL=incidentRoutes.js.map