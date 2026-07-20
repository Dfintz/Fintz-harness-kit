import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class MissionController extends BaseController {
    private readonly missionService;
    private aiService?;
    constructor();
    private getAIService;
    createMission: (req: Request, res: Response) => Promise<void>;
    getMission: (req: Request, res: Response) => Promise<void>;
    getAllMissions: (req: Request, res: Response) => Promise<void>;
    updateMission: (req: Request, res: Response) => Promise<void>;
    deleteMission: (req: Request, res: Response) => Promise<void>;
    getWorkflow: (req: Request, res: Response) => Promise<void>;
    advanceWorkflowPhase: (req: Request, res: Response) => Promise<void>;
    updateStatus: (req: Request, res: Response) => Promise<void>;
    completeMission: (req: Request, res: Response) => Promise<void>;
    assignMission: (req: Request, res: Response) => Promise<void>;
    getParticipants: (req: Request, res: Response) => Promise<void>;
    addParticipant: (req: Request, res: Response) => Promise<void>;
    removeParticipant: (req: Request, res: Response) => Promise<void>;
    generateBriefing: (req: Request, res: Response) => Promise<void>;
    generateBriefingStream: (req: Request, res: Response) => Promise<void>;
    addObjective: (req: Request, res: Response) => Promise<void>;
    updateObjective: (req: Request, res: Response) => Promise<void>;
    removeObjective: (req: Request, res: Response) => Promise<void>;
    getTemplates: (req: Request, res: Response) => Promise<void>;
    getMissionsByFleet: (req: Request, res: Response) => Promise<void>;
    getActiveMissions: (req: Request, res: Response) => Promise<void>;
    searchScmdbMissionCards: (req: Request, res: Response) => Promise<void>;
    importScmdbMissions: (req: Request, res: Response) => Promise<void>;
    getScmdbFilters: (req: Request, res: Response) => Promise<void>;
    importScmdbByUrl: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=missionController.d.ts.map