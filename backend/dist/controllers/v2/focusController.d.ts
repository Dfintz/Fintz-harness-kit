import { Request, Response } from 'express';
export declare class FocusControllerV2 {
    private readonly service;
    getFocusList(_req: Request, res: Response): Promise<void>;
    setUserFocus(req: Request, res: Response): Promise<void>;
    getUserFocus(req: Request, res: Response): Promise<void>;
    setOrgFocus(req: Request, res: Response): Promise<void>;
    getOrgFocus(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=focusController.d.ts.map