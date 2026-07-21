import express, { Response } from 'express';

import { AuthRequest } from '../../middleware/auth';
import { validateSchema } from '../../middleware/schemaValidation';
import { incidentSchemas, paramSchemas } from '../../schemas/incidentSchemas';
import { IncidentResponseService } from '../../services/compliance';
import { ApiError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

const router = express.Router();

// Initialize service (will be properly injected via dependency injection in production)
const incidentService = new IncidentResponseService();

/**
 * Responds with a typed ApiError's own status code and message when present.
 * Returns true if the error was handled, allowing callers to fall back to the
 * generic 500 response for plain Error instances.
 */
function respondTypedApiError(res: Response, error: unknown): boolean {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return true;
  }
  return false;
}

/**
 * @route POST /admin/incidents/report
 * @description Report a new security incident
 * @access Admin only
 */
router.post(
  '/report',
  validateSchema(incidentSchemas.reportBreach, 'body'),
  async (req: AuthRequest, res) => {
    try {
      const { title, description, severity, affectedUsers, affectedDataTypes } = req.body;

      const incident = await incidentService.reportBreach({
        title,
        description,
        severity,
        affectedUsers: affectedUsers || [],
        affectedDataTypes: affectedDataTypes || [],
      });

      logger.info('Incident reported via API', {
        incidentId: incident.id,
        userId: req.user?.id,
      });

      res.status(201).json(incident);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to report incident', { error: errorMessage });
      res.status(500).json({ error: 'Failed to report incident' });
    }
  }
);

/**
 * @route POST /admin/incidents/:id/notify
 * @description Send breach notifications to affected users
 * @access Admin only
 */
router.post(
  '/:id/notify',
  validateSchema(paramSchemas.incidentId, 'params'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const incident = await incidentService.getById(id);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      await incidentService.notifyAffectedUsers(incident);

      logger.info('Incident notifications sent via API', {
        incidentId: id,
        userId: req.user?.id,
      });

      res.json({
        message: 'Notifications sent',
        notifiedCount: incident.notifiedUsers.length,
        errorCount: incident.notificationErrors.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send notifications', { error: errorMessage });
      res.status(500).json({ error: 'Failed to send notifications' });
    }
  }
);

/**
 * @route GET /admin/incidents/:id/report
 * @description Generate formal breach report
 * @access Admin only
 */
router.get(
  '/:id/report',
  validateSchema(paramSchemas.incidentId, 'params'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const incident = await incidentService.getById(id);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const report = await incidentService.generateBreachReport(incident);

      logger.info('Incident report generated via API', {
        incidentId: id,
        userId: req.user?.id,
      });

      res.setHeader('Content-Type', 'text/plain');
      res.send(report);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate report', { error: errorMessage });
      res.status(500).json({ error: 'Failed to generate report' });
    }
  }
);

/**
 * @route GET /admin/incidents
 * @description List all incidents
 * @access Admin only
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const incidents = await incidentService.listIncidents();

    logger.info('Incidents listed via API', {
      count: incidents.length,
      userId: req.user?.id,
    });

    res.json(incidents);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to list incidents', { error: errorMessage });
    res.status(500).json({ error: 'Failed to list incidents' });
  }
});

/**
 * @route GET /admin/incidents/:id
 * @description Get incident details
 * @access Admin only
 */
router.get(
  '/:id',
  validateSchema(paramSchemas.incidentId, 'params'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      const incident = await incidentService.getById(id);
      if (!incident) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      logger.info('Incident retrieved via API', {
        incidentId: id,
        userId: req.user?.id,
      });

      res.json(incident);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get incident', { error: errorMessage });
      res.status(500).json({ error: 'Failed to get incident' });
    }
  }
);

/**
 * @route PATCH /admin/incidents/:id/status
 * @description Update incident status
 * @access Admin only
 */
router.patch(
  '/:id/status',
  validateSchema(paramSchemas.incidentId, 'params'),
  validateSchema(incidentSchemas.updateStatus, 'body'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const incident = await incidentService.updateStatus(id, status);

      logger.info('Incident status updated via API', {
        incidentId: id,
        newStatus: status,
        userId: req.user?.id,
      });

      res.json(incident);
    } catch (error) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to update incident status', { error: errorMessage });
      res.status(500).json({ error: 'Failed to update incident status' });
    }
  }
);

/**
 * @route POST /admin/incidents/:id/remediation
 * @description Add remediation step to incident
 * @access Admin only
 */
router.post(
  '/:id/remediation',
  validateSchema(paramSchemas.incidentId, 'params'),
  validateSchema(incidentSchemas.addRemediationStep, 'body'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { step } = req.body;

      const incident = await incidentService.addRemediationStep(id, step);

      logger.info('Remediation step added via API', {
        incidentId: id,
        userId: req.user?.id,
      });

      res.json(incident);
    } catch (error) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add remediation step', { error: errorMessage });
      res.status(500).json({ error: 'Failed to add remediation step' });
    }
  }
);

/**
 * @route POST /admin/incidents/:id/recommendation
 * @description Add recommendation to incident
 * @access Admin only
 */
router.post(
  '/:id/recommendation',
  validateSchema(paramSchemas.incidentId, 'params'),
  validateSchema(incidentSchemas.addRecommendation, 'body'),
  async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { recommendation } = req.body;

      const incident = await incidentService.addRecommendation(id, recommendation);

      logger.info('Recommendation added via API', {
        incidentId: id,
        userId: req.user?.id,
      });

      res.json(incident);
    } catch (error) {
      if (respondTypedApiError(res, error)) {
        return;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to add recommendation', { error: errorMessage });
      res.status(500).json({ error: 'Failed to add recommendation' });
    }
  }
);

export { router };
