import 'reflect-metadata';
import { Repository } from 'typeorm';

import { Operation, OperationStatus, OperationType } from '../../models/Operation';
import { OperationService } from '../../services/activity';

// Mock repository approach to avoid complex entity graph dependencies in unit tests
// This allows us to test service logic (validation, caching, filtering) without full ORM
describe('OperationService', () => {
  let service: OperationService;
  let mockRepository: jest.Mocked<Repository<Operation>>;
  const TEST_ORG_ID = 'org-test-123';

  beforeEach(() => {
    // Create a mock repository with the methods OperationService uses
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      metadata: { name: 'Operation' }
    } as any;
    
    service = new OperationService(mockRepository);
  });

  it('creates an operation with required fields', async () => {
    const mockOperation = {
      id: 'op-123',
      organizationId: TEST_ORG_ID,
      type: OperationType.MISSION,
      name: 'Test Mission',
      status: OperationStatus.PLANNED,
      participants: [],
      createdBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date()
    } as Operation;

    mockRepository.create.mockReturnValue(mockOperation);
    mockRepository.save.mockResolvedValue(mockOperation);

    const op = await service.createOperation(TEST_ORG_ID, {
      type: OperationType.MISSION,
      name: 'Test Mission'
    }, 'user-1');

    expect(mockRepository.create).toHaveBeenCalled();
    expect(mockRepository.save).toHaveBeenCalled();
    expect(op.status).toBe(OperationStatus.PLANNED);
    expect(op.type).toBe(OperationType.MISSION);
    expect(op.organizationId).toBe(TEST_ORG_ID);
  });

  it('rejects creation without name', async () => {
    await expect(service.createOperation(TEST_ORG_ID, {
      type: OperationType.EVENT,
      name: ''
    }, 'user-2')).rejects.toThrow('name and type are required');
    
    expect(mockRepository.create).not.toHaveBeenCalled();
    expect(mockRepository.save).not.toHaveBeenCalled();
  });

  it('fetches operations by type', async () => {
    const mockOps = [
      { id: 'op-1', type: OperationType.MINING, organizationId: TEST_ORG_ID } as Operation,
      { id: 'op-2', type: OperationType.MINING, organizationId: TEST_ORG_ID } as Operation
    ];

    mockRepository.find.mockResolvedValue(mockOps);

    const ops = await service.getOperationsByType(TEST_ORG_ID, OperationType.MINING);

    expect(mockRepository.find).toHaveBeenCalled();
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe(OperationType.MINING);
  });

  it('fetches active operations', async () => {
    const mockActiveOps = [
      { id: 'op-3', status: OperationStatus.IN_PROGRESS, organizationId: TEST_ORG_ID } as Operation
    ];

    mockRepository.find.mockResolvedValue(mockActiveOps);

    const ops = await service.getActiveOperations(TEST_ORG_ID);

    expect(mockRepository.find).toHaveBeenCalled();
    expect(ops).toHaveLength(1);
    expect(ops[0].status).toBe(OperationStatus.IN_PROGRESS);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
