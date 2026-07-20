import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { BaseController } from './BaseController';
export declare class WebhookController extends BaseController {
    private readonly webhookService;
    constructor();
    validateWebhook: (req: AuthRequest, res: Response) => Promise<void>;
    createWebhook: (req: AuthRequest, res: Response) => Promise<void>;
    getWebhooks: (req: AuthRequest, res: Response) => Promise<void>;
    getWebhook: (req: AuthRequest, res: Response) => Promise<void>;
    updateWebhook: (req: AuthRequest, res: Response) => Promise<void>;
    deleteWebhook: (req: AuthRequest, res: Response) => Promise<void>;
    testWebhook: (req: AuthRequest, res: Response) => Promise<void>;
    triggerEvent: (req: AuthRequest, res: Response) => Promise<void>;
    getStatistics: (req: AuthRequest, res: Response) => Promise<void>;
    getDeliveryHistory: (req: AuthRequest, res: Response) => Promise<void>;
    getEventTypes: (req: Request, res: Response) => Promise<void>;
    private formatEventLabel;
    private getEventCategory;
    private requireUuid;
    private parseWebhookEvent;
    private sanitizeWebhookPayload;
    private validateWebhookDestination;
    private assertStoredWebhookDestination;
    testWebhookCustom: (req: AuthRequest, res: Response) => Promise<void>;
    getPayloadPreview: (req: AuthRequest, res: Response) => Promise<void>;
    getBatchConfig: (req: AuthRequest, res: Response) => Promise<void>;
    configureBatch: (req: AuthRequest, res: Response) => Promise<void>;
    queueEventForBatch: (req: AuthRequest, res: Response) => Promise<void>;
    getPendingBatches: (req: AuthRequest, res: Response) => Promise<void>;
    flushBatches: (req: AuthRequest, res: Response) => Promise<void>;
    cancelPendingBatches: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=webhookController.d.ts.map