import { Request, Response } from 'express';

import { AlertFilterOptions, CreateAlertDto, UpdateAlertDto } from '../models/LogisticsAlert';
import { LogisticsAlertService } from '../services/trade/logistics/LogisticsAlertService';
import { NotFoundError } from '../utils/apiErrors';
import { parseBooleanQuery } from '../utils/queryUtils';

import { BaseController } from './BaseController';

/**
 * Controller for logistics alerts
 * Extends BaseController for standardized error handling
 */
export class LogisticsAlertController extends BaseController {
    private alertService = new LogisticsAlertService();

    constructor() {
        super();
    }

    /**
     * Create custom alert
     * POST /api/logistics/alerts
     */
    public createAlert = async (req: Request, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const dto: CreateAlertDto = req.body;
            const alert = await this.alertService.createAlert(dto);
            res.status(201).json(alert);
        });
    };

    /**
     * Get alerts with filtering
     * GET /api/logistics/alerts
     */
    public getAlerts = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const filters: AlertFilterOptions = {
                fleetId: req.query.fleetId as string,
                inventoryItemId: req.query.inventoryItemId as string,
                type: req.query.type as unknown as AlertFilterOptions['type'],
                severity: req.query.severity as unknown as AlertFilterOptions['severity'],
                status: req.query.status as unknown as AlertFilterOptions['status'],
                unacknowledgedOnly: parseBooleanQuery(req.query.unacknowledgedOnly),
                activeOnly: parseBooleanQuery(req.query.activeOnly)
            };

            return this.alertService.getAlerts(filters);
        });
    };

    /**
     * Get alert by ID
     * GET /api/logistics/alerts/:id
     */
    public getAlert = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const alert = await this.alertService.getAlertById(id);

            if (!alert) {
                throw new NotFoundError('Alert');
            }

            return alert;
        });
    };

    /**
     * Update alert
     * PATCH /api/logistics/alerts/:id
     */
    public updateAlert = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const dto: UpdateAlertDto = req.body;
            return this.alertService.updateAlert(id, dto);
        });
    };

    /**
     * Acknowledge alert
     * POST /api/logistics/alerts/:id/acknowledge
     */
    public acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const { userId } = req.body;
            return this.alertService.acknowledgeAlert(id, userId);
        });
    };

    /**
     * Resolve alert
     * POST /api/logistics/alerts/:id/resolve
     */
    public resolveAlert = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const { userId, notes } = req.body;
            return this.alertService.resolveAlert(id, userId, notes);
        });
    };

    /**
     * Dismiss alert
     * POST /api/logistics/alerts/:id/dismiss
     */
    public dismissAlert = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            return this.alertService.dismissAlert(id);
        });
    };

    /**
     * Delete alert
     * DELETE /api/logistics/alerts/:id
     */
    public deleteAlert = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            await this.alertService.deleteAlert(id);
            return { message: 'Alert deleted successfully' };
        });
    };

    /**
     * Get alert statistics
     * GET /api/logistics/alerts/fleet/:fleetId/statistics
     */
    public getAlertStatistics = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.params;
            return this.alertService.getAlertStatistics(fleetId);
        });
    };

    /**
     * Check inventory and generate alerts
     * POST /api/logistics/alerts/check-inventory
     */
    public checkInventoryAndGenerateAlerts = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.body;
            const alerts = await this.alertService.checkInventoryAndGenerateAlerts(fleetId);
            return {
                message: 'Inventory check completed',
                alertsGenerated: alerts.length,
                alerts
            };
        });
    };

    /**
     * Auto-resolve alerts
     * POST /api/logistics/alerts/auto-resolve
     */
    public autoResolveAlerts = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const resolvedCount = await this.alertService.autoResolveAlerts();
            return {
                message: 'Auto-resolve completed',
                resolvedCount
            };
        });
    };
}
