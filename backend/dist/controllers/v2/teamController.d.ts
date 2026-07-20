import { Request, Response } from 'express';
export declare class TeamControllerV2 {
    private service;
    listTeams(req: Request, res: Response): Promise<void>;
    getTeamTree(req: Request, res: Response): Promise<void>;
    createTeam(req: Request, res: Response): Promise<void>;
    getTeamById(req: Request, res: Response): Promise<void>;
    updateTeam(req: Request, res: Response): Promise<void>;
    deleteTeam(req: Request, res: Response): Promise<void>;
    moveTeam(req: Request, res: Response): Promise<void>;
    reorderTeams(req: Request, res: Response): Promise<void>;
    getMembers(req: Request, res: Response): Promise<void>;
    addMember(req: Request, res: Response): Promise<void>;
    updateMember(req: Request, res: Response): Promise<void>;
    removeMember(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=teamController.d.ts.map