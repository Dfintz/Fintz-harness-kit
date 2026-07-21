import { AppDataSource } from '../../../data-source';
import {
  UserShip,
  ShipOwnershipStatus,
  ShipCondition,
  ShipSharingLevel,
} from '../../../models/UserShip';
import { UserShipService } from '../UserShipService';

// Mock dependencies
jest.mock('../../../config/database');
describe('UserShipService - getShipsNeedingInsurance', () => {
  let service: UserShipService;
  let mockRepository: any;

  // Test data
  const testUserId1 = 'user-456';
  const testUserId2 = 'user-789';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock query builder
    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    };

    // Setup repository mock with metadata
    mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      metadata: {
        name: 'UserShip',
      },
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock) = jest.fn(() => mockRepository);

    service = new UserShipService();
  });

  describe('with userId filter', () => {
    it('should return ships needing insurance for a specific user', async () => {
      // Arrange
      const now = new Date();
      const expiringSoon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000); // 5 days from now
      const expiringLater = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000); // 20 days from now

      const mockShips: UserShip[] = [
        {
          id: 'ship-1',
          userId: testUserId1,
          shipId: 'cutlass-black',
          shipName: 'Cutlass Black',
          status: ShipOwnershipStatus.OWNED,
          condition: ShipCondition.GOOD,
          sharingLevel: ShipSharingLevel.PERSONAL,
          insuranceExpires: expiringSoon,
          insuranceLevel: 'Standard',
          isActive: true,
        } as UserShip,
        {
          id: 'ship-2',
          userId: testUserId1,
          shipId: 'aurora-mr',
          shipName: 'Aurora MR',
          status: ShipOwnershipStatus.OWNED,
          condition: ShipCondition.EXCELLENT,
          sharingLevel: ShipSharingLevel.PERSONAL,
          insuranceExpires: expiringLater,
          insuranceLevel: 'Premium',
          isActive: true,
        } as UserShip,
      ];

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(mockShips);

      // Act
      const result = await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('ship');
      expect(queryBuilder.where).toHaveBeenCalledWith('ship.insuranceExpires IS NOT NULL');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('ship.userId = :userId', {
        userId: testUserId1,
      });
      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('daysUntilExpiration');
      expect(result[0]).toHaveProperty('ship');
      expect(result[0].daysUntilExpiration).toBeGreaterThanOrEqual(4);
      expect(result[0].daysUntilExpiration).toBeLessThanOrEqual(5);
      expect(result[1].daysUntilExpiration).toBeGreaterThanOrEqual(19);
      expect(result[1].daysUntilExpiration).toBeLessThanOrEqual(20);
    });

    it('should filter ships by userId when provided', async () => {
      // Arrange
      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('ship.userId = :userId', {
        userId: testUserId1,
      });
    });
  });

  describe('without userId filter', () => {
    it('should return ships for all users when userId not provided', async () => {
      // Arrange
      const now = new Date();
      const expiringSoon = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days from now

      const mockShips: UserShip[] = [
        {
          id: 'ship-1',
          userId: testUserId1,
          shipId: 'cutlass-black',
          shipName: 'Cutlass Black',
          insuranceExpires: expiringSoon,
          isActive: true,
        } as UserShip,
        {
          id: 'ship-2',
          userId: testUserId2,
          shipId: 'constellation',
          shipName: 'Constellation',
          insuranceExpires: expiringSoon,
          isActive: true,
        } as UserShip,
      ];

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(mockShips);

      // Act
      const result = await service.getShipsNeedingInsurance(undefined, 30);

      // Assert
      expect(queryBuilder.where).toHaveBeenCalledWith('ship.insuranceExpires IS NOT NULL');
      // userId filter should NOT be applied
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        'ship.userId = :userId',
        expect.anything()
      );
      expect(result).toHaveLength(2);
      expect(result.some(r => r.ship.userId === testUserId1)).toBe(true);
      expect(result.some(r => r.ship.userId === testUserId2)).toBe(true);
    });
  });

  describe('threshold filtering', () => {
    it('should use default threshold of 30 days when not provided', async () => {
      // Arrange
      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getShipsNeedingInsurance(undefined);

      // Assert
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'ship.insuranceExpires <= :thresholdDate',
        expect.objectContaining({ thresholdDate: expect.any(Date) })
      );
    });

    it('should respect custom threshold of 7 days', async () => {
      // Arrange
      const now = new Date();
      const expiring5Days = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
      const expiring10Days = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

      const mockShips: UserShip[] = [
        {
          id: 'ship-1',
          userId: testUserId1,
          shipId: 'cutlass-black',
          shipName: 'Cutlass Black',
          insuranceExpires: expiring5Days,
          isActive: true,
        } as UserShip,
      ];

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(mockShips);

      // Act
      const result = await service.getShipsNeedingInsurance(testUserId1, 7);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].daysUntilExpiration).toBeGreaterThanOrEqual(4);
      expect(result[0].daysUntilExpiration).toBeLessThanOrEqual(5);
    });
  });

  describe('expired insurance', () => {
    it('should include ships with expired insurance (negative days)', async () => {
      // Arrange
      const now = new Date();
      const expired = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      const mockShips: UserShip[] = [
        {
          id: 'ship-1',
          userId: testUserId1,
          shipId: 'cutlass-black',
          shipName: 'Cutlass Black',
          insuranceExpires: expired,
          isActive: true,
        } as UserShip,
      ];

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(mockShips);

      // Act
      const result = await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].daysUntilExpiration).toBeLessThan(0);
      expect(result[0].daysUntilExpiration).toBeGreaterThanOrEqual(-6);
      expect(result[0].daysUntilExpiration).toBeLessThanOrEqual(-4);
    });
  });

  describe('edge cases', () => {
    it('should filter out ships without insurance expiration date', async () => {
      // Arrange
      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(queryBuilder.where).toHaveBeenCalledWith('ship.insuranceExpires IS NOT NULL');
    });

    it('should filter out inactive ships', async () => {
      // Arrange
      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('ship.isActive = :isActive', {
        isActive: true,
      });
    });

    it('should return empty array when no ships match criteria', async () => {
      // Arrange
      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([]);

      // Act
      const result = await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(result).toEqual([]);
    });

    it('should order results by insurance expiration date ascending', async () => {
      // Arrange
      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([]);

      // Act
      await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('ship.insuranceExpires', 'ASC');
    });
  });

  describe('enrichment', () => {
    it('should enrich all ships with daysUntilExpiration', async () => {
      // Arrange
      const now = new Date();
      const dates = [
        new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // -2 days (expired)
        new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // +5 days
        new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // +15 days
      ];

      const mockShips: UserShip[] = dates.map(
        (date, i) =>
          ({
            id: `ship-${i}`,
            userId: testUserId1,
            shipId: `ship-type-${i}`,
            shipName: `Ship ${i}`,
            insuranceExpires: date,
            isActive: true,
          }) as UserShip
      );

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue(mockShips);

      // Act
      const result = await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].daysUntilExpiration).toBeLessThan(0);
      expect(result[1].daysUntilExpiration).toBeGreaterThan(0);
      expect(result[2].daysUntilExpiration).toBeGreaterThan(result[1].daysUntilExpiration);
    });

    it('should preserve all original ship properties', async () => {
      // Arrange
      const now = new Date();
      const expiringSoon = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

      const mockShip: UserShip = {
        id: 'ship-1',
        userId: testUserId1,
        shipId: 'cutlass-black',
        shipName: 'Cutlass Black',
        customName: 'My Cutlass',
        status: ShipOwnershipStatus.OWNED,
        condition: ShipCondition.GOOD,
        sharingLevel: ShipSharingLevel.PERSONAL,
        insuranceExpires: expiringSoon,
        insuranceLevel: 'Standard',
        isActive: true,
        location: 'Port Olisar',
        hangar: 'A1',
        notes: 'Test notes',
      } as UserShip;

      const queryBuilder = mockRepository.createQueryBuilder();
      queryBuilder.getMany.mockResolvedValue([mockShip]);

      // Act
      const result = await service.getShipsNeedingInsurance(testUserId1, 30);

      // Assert
      expect(result[0]).toMatchObject({
        ship: expect.objectContaining({
          id: 'ship-1',
          shipName: 'Cutlass Black',
          customName: 'My Cutlass',
          status: ShipOwnershipStatus.OWNED,
          condition: ShipCondition.GOOD,
          insuranceLevel: 'Standard',
          location: 'Port Olisar',
          hangar: 'A1',
          notes: 'Test notes',
        }),
      });
      expect(result[0].daysUntilExpiration).toBeDefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

