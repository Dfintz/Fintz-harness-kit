import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class MobileReleaseController extends BaseController {
    private readonly mobileReleaseStorageService;
    constructor();
    downloadRelease: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=mobileReleaseController.d.ts.map