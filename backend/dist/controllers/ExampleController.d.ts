import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class ExampleController extends BaseController {
    list(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<void>;
    create(req: Request, res: Response): Promise<void>;
    update(req: Request, res: Response): Promise<void>;
    delete(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=ExampleController.d.ts.map