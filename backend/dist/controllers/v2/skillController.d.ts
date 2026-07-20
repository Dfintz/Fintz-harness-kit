import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { BaseController } from '../BaseController';
export declare class SkillController extends BaseController {
    private readonly skillService;
    constructor();
    listSkills: (req: AuthRequest, res: Response) => Promise<void>;
    getSkill: (req: AuthRequest, res: Response) => Promise<void>;
    createSkill: (req: AuthRequest, res: Response) => Promise<void>;
    updateSkill: (req: AuthRequest, res: Response) => Promise<void>;
    deleteSkill: (req: AuthRequest, res: Response) => Promise<void>;
    getUserSkills: (req: AuthRequest, res: Response) => Promise<void>;
    endorseSkill: (req: AuthRequest, res: Response) => Promise<void>;
    getCategories: (req: AuthRequest, res: Response) => Promise<void>;
}
//# sourceMappingURL=skillController.d.ts.map