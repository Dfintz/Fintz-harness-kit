import { Request, Response } from 'express';

import { AppDataSource } from '../config/database';
import { Tournament, TournamentStatus, MatchStatus, Match } from '../models/Tournament';
import { NotFoundError, ValidationError } from '../utils/apiErrors';
import { extractPaginationOptions, paginateRepository } from '../utils/pagination';


import { BaseController } from './BaseController';

/**
 * Controller for tournament operations
 * Extends BaseController for standardized error handling
 */
export class TournamentController extends BaseController {
    private tournamentRepository = AppDataSource.getRepository(Tournament);

    constructor() {
        super();
    }

    public createTournament = async (req: Request, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const { name, description, organizerId, startDate, maxParticipants, prizePool, rules } = req.body;
            
            const tournament = this.tournamentRepository.create({
                id: `tournament-${Date.now()}`,
                name,
                description,
                organizerId,
                startDate: new Date(startDate),
                maxParticipants: maxParticipants || 8,
                prizePool,
                rules,
                status: TournamentStatus.REGISTRATION,
                participants: [],
                matches: []
            });

            await this.tournamentRepository.save(tournament);
            res.status(201).json(tournament);
        });
    };

    public getTournaments = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const paginationOptions = extractPaginationOptions(req);
            return paginateRepository(
                this.tournamentRepository,
                paginationOptions,
                undefined,
                'startDate'
            );
        });
    };

    public getTournamentById = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            
            if (!tournament) {
                throw new NotFoundError('Tournament');
            }
            
            return tournament;
        });
    };

    public registerParticipant = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const { userId, teamName } = req.body;
            
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            
            if (!tournament) {
                throw new NotFoundError('Tournament');
            }

            if (tournament.status !== TournamentStatus.REGISTRATION) {
                throw new ValidationError('Tournament registration is closed');
            }

            if (tournament.participants.length >= tournament.maxParticipants) {
                throw new ValidationError('Tournament is full');
            }

            tournament.participants.push({
                userId,
                teamName,
                registeredAt: new Date()
            });

            await this.tournamentRepository.save(tournament);
            return tournament;
        });
    };

    public startTournament = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            
            if (!tournament) {
                throw new NotFoundError('Tournament');
            }

            tournament.status = TournamentStatus.IN_PROGRESS;
            
            // Generate initial bracket
            const matches = this.generateBracket(tournament.participants);
            tournament.matches = matches;

            await this.tournamentRepository.save(tournament);
            return tournament;
        });
    };

    private generateBracket(participants: { userId: string }[]): Match[] {
        const matches: Match[] = [];
        const _numRounds = Math.ceil(Math.log2(participants.length));
        
        for (let i = 0; i < Math.floor(participants.length / 2); i++) {
            matches.push({
                matchId: `match-${Date.now()}-${i}`,
                round: 1,
                participant1Id: participants[i * 2]?.userId,
                participant2Id: participants[i * 2 + 1]?.userId,
                status: MatchStatus.PENDING
            });
        }
        
        return matches;
    }

    public updateMatch = async (req: Request, res: Response): Promise<void> => {
        await this.executeAndReturn(req, res, async () => {
            const { id, matchId } = req.params;
            const { winnerId, score } = req.body;
            
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            
            if (!tournament) {
                throw new NotFoundError('Tournament');
            }

            const match = tournament.matches.find(m => m.matchId === matchId);
            if (!match) {
                throw new NotFoundError('Match');
            }

            match.winnerId = winnerId;
            match.score = score;
            match.status = MatchStatus.COMPLETED;
            match.completedAt = new Date();

            await this.tournamentRepository.save(tournament);
            return tournament;
        });
    };
}
