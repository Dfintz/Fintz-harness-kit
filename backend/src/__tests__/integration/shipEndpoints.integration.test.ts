import { Column, Entity, PrimaryColumn } from 'typeorm';

const ShipSizeStub = {
  VEHICLE: 'vehicle',
  SNUB: 'snub',
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  SUB_CAPITAL: 'sub_capital',
  CAPITAL: 'capital',
} as const;

const ShipStatusStub = {
  FLIGHT_READY: 'flight_ready',
  IN_CONCEPT: 'in_concept',
  IN_PRODUCTION: 'in_production',
  ANNOUNCED: 'announced',
} as const;

// Minimal Ship stub for testing (SQLite-compatible)
@Entity('ships')
class ShipStub {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;

  @Column()
  manufacturer!: string;

  @Column({ nullable: true })
  role?: string;

  @Column({ nullable: true })
  size?: string;

  @Column({ nullable: true })
  status?: string;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: false })
  isVehicle!: boolean;

  @Column({ nullable: true })
  organizationId?: string;

  @Column({ type: 'datetime', nullable: true })
  lastFetchedAt?: Date | null;

  @Column({ type: 'datetime', nullable: true })
  createdAt?: Date;

  @Column({ type: 'datetime', nullable: true })
  updatedAt?: Date;
}

// Minimal Organization stub for testing (SQLite-compatible)
// Must be defined before mocking
@Entity('organizations')
class OrganizationStub {
  @PrimaryColumn()
  id!: string;

  @Column()
  name!: string;
}

// Minimal FleetShip stub for testing (SQLite-compatible)
@Entity('fleet_ships')
class FleetShipStub {
  @PrimaryColumn()
  id!: string;

  @Column()
  fleetId!: string;

  @Column()
  shipId!: string;

  @Column({ nullable: true })
  organizationId?: string;
}

// Mock the Organization model BEFORE importing anything that uses it
jest.mock('../../models/Organization', () => ({
  Organization: OrganizationStub,
  OrganizationType: {
    ROOT: 'root',
    DIVISION: 'division',
    DEPARTMENT: 'department',
    TEAM: 'team',
    PROJECT: 'project',
  },
  OrganizationStatus: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    ARCHIVED: 'archived',
    SUSPENDED: 'suspended',
  },
}));

// Mock the FleetShip model
jest.mock('../../models/FleetShip', () => ({
  FleetShip: FleetShipStub,
}));

jest.mock('../../models/Ship', () => ({
  Ship: ShipStub,
  ShipSize: ShipSizeStub,
  ShipStatus: ShipStatusStub,
}));

// Mock authentication middleware
jest.mock('../../middleware/auth', () => ({
  authenticateToken: jest.fn((req, res, next) => {
    req.user = { id: 'test-user-123', username: 'testuser', role: 'admin' };
    next();
  }),
}));

// Now import after mocks are set up
import express from 'express';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { Ship, ShipSize, ShipStatus } from '../../models/Ship';
import { setShipDataRoutes } from '../../routes/shipDataRoutes';

describe('Ship Endpoints Integration Tests', () => {
  let app: express.Application;
  let dataSource: DataSource;
  let shipRepository: any;

  beforeAll(async () => {
    // Initialize test database connection
    // Use OrganizationStub instead of full Organization to avoid enum type issues with SQLite
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      synchronize: true,
      logging: false,
      entities: [Ship, OrganizationStub, FleetShipStub],
    });

    await dataSource.initialize();
    shipRepository = dataSource.getRepository(Ship);

    // Create test organization
    const orgRepository = dataSource.getRepository(OrganizationStub);
    await orgRepository.save({ id: 'test-org', name: 'Test Organization' });

    // Mock AppDataSource to use our test data source
    (AppDataSource.getRepository as jest.Mock) = jest.fn(() => shipRepository);
    (AppDataSource.initialize as jest.Mock) = jest.fn();
    (AppDataSource.isInitialized as any) = true;

    // Setup Express app with routes
    app = express();
    app.use(express.json());
    setShipDataRoutes(app);
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  beforeEach(async () => {
    // Clear all ships before each test
    await shipRepository.clear();
  });

  describe('GET /api/ships', () => {
    it('should return paginated ships list', async () => {
      // Seed test data
      const testShips = [
        shipRepository.create({
          id: 'aegis-avenger-titan',
          name: 'Avenger Titan',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'anvil-hornet',
          name: 'F7C Hornet',
          manufacturer: 'Anvil Aerospace',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'origin-890-jump',
          name: '890 Jump',
          manufacturer: 'Origin Jumpworks',
          size: ShipSize.LARGE,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ];

      await shipRepository.save(testShips);

      const response = await request(app)
        .get('/api/ships')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
    });

    it('should filter ships by manufacturer', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'aegis-avenger-titan',
          name: 'Avenger Titan',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'anvil-hornet',
          name: 'F7C Hornet',
          manufacturer: 'Anvil Aerospace',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app)
        .get('/api/ships')
        .query({ manufacturer: 'Aegis Dynamics', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].manufacturer).toBe('Aegis Dynamics');
    });

    it('should filter ships by size', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'aegis-avenger-titan',
          name: 'Avenger Titan',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'origin-890-jump',
          name: '890 Jump',
          manufacturer: 'Origin Jumpworks',
          size: ShipSize.LARGE,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app)
        .get('/api/ships')
        .query({ size: ShipSize.LARGE, page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].size).toBe(ShipSize.LARGE);
    });

    it('should search ships by name', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'aegis-avenger-titan',
          name: 'Avenger Titan',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'anvil-hornet',
          name: 'F7C Hornet',
          manufacturer: 'Anvil Aerospace',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app)
        .get('/api/ships')
        .query({ search: 'Avenger', page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toContain('Avenger');
    });

    it('should handle pagination correctly', async () => {
      // Seed test data with multiple ships
      const ships = [];
      for (let i = 1; i <= 15; i++) {
        ships.push(
          shipRepository.create({
            id: `ship-${i}`,
            name: `Ship ${i}`,
            manufacturer: 'Test Manufacturer',
            size: ShipSize.SMALL,
            status: ShipStatus.FLIGHT_READY,
            isActive: true,
            isVehicle: false,
            organizationId: 'test-org',
          })
        );
      }
      await shipRepository.save(ships);

      // Test page 1
      const page1Response = await request(app)
        .get('/api/ships')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(page1Response.body.data).toHaveLength(10);
      expect(page1Response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 15,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });

      // Test page 2
      const page2Response = await request(app)
        .get('/api/ships')
        .query({ page: 2, limit: 10 })
        .expect(200);

      expect(page2Response.body.data).toHaveLength(5);
      expect(page2Response.body.pagination).toMatchObject({
        page: 2,
        limit: 10,
        total: 15,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });

    it('should only return active ships', async () => {
      // Seed test data with active and inactive ships
      await shipRepository.save([
        shipRepository.create({
          id: 'active-ship',
          name: 'Active Ship',
          manufacturer: 'Test',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'inactive-ship',
          name: 'Inactive Ship',
          manufacturer: 'Test',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: false,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app)
        .get('/api/ships')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isActive).toBe(true);
    });
  });

  describe('GET /api/ships/manufacturers', () => {
    it('should return list of distinct manufacturers', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'aegis-1',
          name: 'Ship 1',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'aegis-2',
          name: 'Ship 2',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'anvil-1',
          name: 'Ship 3',
          manufacturer: 'Anvil Aerospace',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app).get('/api/ships/manufacturers').expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body).toContain('Aegis Dynamics');
      expect(response.body).toContain('Anvil Aerospace');
    });

    it('should only return manufacturers of active ships', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'active-ship',
          name: 'Active Ship',
          manufacturer: 'Active Manufacturer',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'inactive-ship',
          name: 'Inactive Ship',
          manufacturer: 'Inactive Manufacturer',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: false,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app).get('/api/ships/manufacturers').expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body).toContain('Active Manufacturer');
      expect(response.body).not.toContain('Inactive Manufacturer');
    });

    it('should return manufacturers in alphabetical order', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'ship-1',
          name: 'Ship 1',
          manufacturer: 'Zebra Shipworks',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'ship-2',
          name: 'Ship 2',
          manufacturer: 'Alpha Aerospace',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'ship-3',
          name: 'Ship 3',
          manufacturer: 'Beta Industries',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app).get('/api/ships/manufacturers').expect(200);

      expect(response.body).toEqual(['Alpha Aerospace', 'Beta Industries', 'Zebra Shipworks']);
    });
  });

  describe('GET /api/ships/vehicles', () => {
    it('should return only vehicles with pagination', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'rsi-ursa-rover',
          name: 'Ursa Rover',
          manufacturer: 'Roberts Space Industries',
          size: ShipSize.VEHICLE,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: true,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'aegis-avenger-titan',
          name: 'Avenger Titan',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app)
        .get('/api/ships/vehicles')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isVehicle).toBe(true);
      expect(response.body.data[0].name).toBe('Ursa Rover');
    });
  });

  describe('GET /api/ships/spacecraft', () => {
    it('should return only spacecraft (non-vehicles) with pagination', async () => {
      // Seed test data
      await shipRepository.save([
        shipRepository.create({
          id: 'rsi-ursa-rover',
          name: 'Ursa Rover',
          manufacturer: 'Roberts Space Industries',
          size: ShipSize.VEHICLE,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: true,
          organizationId: 'test-org',
        }),
        shipRepository.create({
          id: 'aegis-avenger-titan',
          name: 'Avenger Titan',
          manufacturer: 'Aegis Dynamics',
          size: ShipSize.SMALL,
          status: ShipStatus.FLIGHT_READY,
          isActive: true,
          isVehicle: false,
          organizationId: 'test-org',
        }),
      ]);

      const response = await request(app)
        .get('/api/ships/spacecraft')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].isVehicle).toBe(false);
      expect(response.body.data[0].name).toBe('Avenger Titan');
    });
  });
});
