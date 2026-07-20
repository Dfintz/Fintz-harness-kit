"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TournamentController = void 0;
const database_1 = require("../config/database");
const Tournament_1 = require("../models/Tournament");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class TournamentController extends BaseController_1.BaseController {
    tournamentRepository = database_1.AppDataSource.getRepository(Tournament_1.Tournament);
    constructor() {
        super();
    }
    createTournament = async (req, res) => {
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
                status: Tournament_1.TournamentStatus.REGISTRATION,
                participants: [],
                matches: []
            });
            await this.tournamentRepository.save(tournament);
            res.status(201).json(tournament);
        });
    };
    getTournaments = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return (0, pagination_1.paginateRepository)(this.tournamentRepository, paginationOptions, undefined, 'startDate');
        });
    };
    getTournamentById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            if (!tournament) {
                throw new apiErrors_1.NotFoundError('Tournament');
            }
            return tournament;
        });
    };
    registerParticipant = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const { userId, teamName } = req.body;
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            if (!tournament) {
                throw new apiErrors_1.NotFoundError('Tournament');
            }
            if (tournament.status !== Tournament_1.TournamentStatus.REGISTRATION) {
                throw new apiErrors_1.ValidationError('Tournament registration is closed');
            }
            if (tournament.participants.length >= tournament.maxParticipants) {
                throw new apiErrors_1.ValidationError('Tournament is full');
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
    startTournament = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id } = req.params;
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            if (!tournament) {
                throw new apiErrors_1.NotFoundError('Tournament');
            }
            tournament.status = Tournament_1.TournamentStatus.IN_PROGRESS;
            const matches = this.generateBracket(tournament.participants);
            tournament.matches = matches;
            await this.tournamentRepository.save(tournament);
            return tournament;
        });
    };
    generateBracket(participants) {
        const matches = [];
        const _numRounds = Math.ceil(Math.log2(participants.length));
        for (let i = 0; i < Math.floor(participants.length / 2); i++) {
            matches.push({
                matchId: `match-${Date.now()}-${i}`,
                round: 1,
                participant1Id: participants[i * 2]?.userId,
                participant2Id: participants[i * 2 + 1]?.userId,
                status: Tournament_1.MatchStatus.PENDING
            });
        }
        return matches;
    }
    updateMatch = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { id, matchId } = req.params;
            const { winnerId, score } = req.body;
            const tournament = await this.tournamentRepository.findOne({ where: { id } });
            if (!tournament) {
                throw new apiErrors_1.NotFoundError('Tournament');
            }
            const match = tournament.matches.find(m => m.matchId === matchId);
            if (!match) {
                throw new apiErrors_1.NotFoundError('Match');
            }
            match.winnerId = winnerId;
            match.score = score;
            match.status = Tournament_1.MatchStatus.COMPLETED;
            match.completedAt = new Date();
            await this.tournamentRepository.save(tournament);
            return tournament;
        });
    };
}
exports.TournamentController = TournamentController;
//# sourceMappingURL=tournamentController.js.map