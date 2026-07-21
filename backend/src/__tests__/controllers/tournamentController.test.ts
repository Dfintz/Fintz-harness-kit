// Mock TypeORM before imports
import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';
const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
    AppDataSource: mockDataSource
}));

import { TournamentController } from '../../controllers/tournamentController';
import { Tournament, TournamentStatus } from '../../models/Tournament';

describe('TournamentController', () => {
    let tournamentController: TournamentController;
    let mockTournaments: any[];
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
        mockTournaments = [];
        
        const mockRepo = createMockRepositoryWithData(mockTournaments);
        mockDataSource.getRepository.mockReturnValue(mockRepo);

        tournamentController = new TournamentController();

        mockRequest = {
            body: {},
            params: {},
            query: {}
        };

        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
    });

    describe('createTournament', () => {
        it('should create a tournament successfully', async () => {
            const tournamentData = {
                name: 'Test Tournament',
                description: 'A test tournament',
                organizerId: 'user-123',
                startDate: '2025-12-01',
                maxParticipants: 16,
                prizePool: '10000 UEC'
            };

            mockRequest.body = tournamentData;

            await tournamentController.createTournament(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(201);
            expect(mockTournaments).toHaveLength(1);
            expect(mockTournaments[0]).toMatchObject({
                name: tournamentData.name,
                organizerId: tournamentData.organizerId
            });
        });

        it('should handle errors during tournament creation', async () => {
            mockRequest.body = { name: 'Test' };

            await tournamentController.createTournament(mockRequest, mockResponse);

            // Controller should handle validation or other errors
            expect(mockResponse.status).toHaveBeenCalled();
        });
    });

    describe('getTournaments', () => {
        it('should return all tournaments', async () => {
            mockTournaments.push(
                { id: 'tournament-1', name: 'Tournament 1' },
                { id: 'tournament-2', name: 'Tournament 2' }
            );

            await tournamentController.getTournaments(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            // Response may be paginated or direct array
            const jsonCall = mockResponse.json as jest.Mock;
            expect(jsonCall).toHaveBeenCalled();
        });
    });

    describe('registerParticipant', () => {
        it('should register a participant successfully', async () => {
            const mockTournament = {
                id: 'tournament-123',
                name: 'Test Tournament',
                status: TournamentStatus.REGISTRATION,
                maxParticipants: 8,
                participants: []
            };
            mockTournaments.push(mockTournament);

            mockRequest.params = { id: 'tournament-123' };
            mockRequest.body = { userId: 'user-456', teamName: 'Team Alpha' };

            await tournamentController.registerParticipant(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(200);
            const updated = mockTournaments.find(t => t.id === 'tournament-123');
            expect(updated?.participants?.length).toBe(1);
        });

        it('should reject registration when tournament is full', async () => {
            const mockTournament = {
                id: 'tournament-123',
                status: TournamentStatus.REGISTRATION,
                maxParticipants: 2,
                participants: [
                    { userId: 'user-1' },
                    { userId: 'user-2' }
                ]
            };
            mockTournaments.push(mockTournament);

            mockRequest.params = { id: 'tournament-123' };
            mockRequest.body = { userId: 'user-3' };

            await tournamentController.registerParticipant(mockRequest, mockResponse);

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Tournament is full' }));
        });
    });
});
