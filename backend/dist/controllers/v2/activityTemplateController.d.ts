import { Request, Response } from 'express';
export declare class ActivityTemplateControllerV2 {
    private activityTemplateService;
    constructor();
    private getOrgId;
    private getUser;
    listTemplates(req: Request, res: Response): Promise<void>;
    createTemplate(req: Request, res: Response): Promise<void>;
    getTemplate(req: Request, res: Response): Promise<void>;
    updateTemplate(req: Request, res: Response): Promise<void>;
    deleteTemplate(req: Request, res: Response): Promise<void>;
    cloneTemplate(req: Request, res: Response): Promise<void>;
    applyTemplate(req: Request, res: Response): Promise<void>;
    getCategories(_req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=activityTemplateController.d.ts.map