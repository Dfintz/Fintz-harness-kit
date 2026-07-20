import { Request, Response } from 'express';
import { BaseController } from './BaseController';
export declare class TournamentController extends BaseController {
    private tournamentRepository;
    constructor();
    createTournament: (req: Request, res: Response) => Promise<void>;
    getTournaments: (req: Request, res: Response) => Promise<void>;
    getTournamentById: (req: Request, res: Response) => Promise<void>;
    registerParticipant: (req: Request, res: Response) => Promise<void>;
    startTournament: (req: Request, res: Response) => Promise<void>;
    private generateBracket;
    updateMatch: (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=tournamentController.d.ts.map