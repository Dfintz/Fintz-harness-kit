import { Request, Response } from 'express';
export declare class RecurringActivityControllerV2 {
    private recurringActivityService;
    constructor();
    calculateNextOccurrence(req: Request, res: Response): Promise<void>;
    generateOccurrences(req: Request, res: Response): Promise<void>;
    parseRecurrenceString(req: Request, res: Response): Promise<void>;
    formatRecurrenceRule(req: Request, res: Response): Promise<void>;
    createRecurringInstances(req: Request, res: Response): Promise<void>;
    previewRecurringActivity(req: Request, res: Response): Promise<void>;
    getFrequencies(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=recurringActivityController.d.ts.map