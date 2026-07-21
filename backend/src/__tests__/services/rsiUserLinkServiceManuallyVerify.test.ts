/**
 * Tests for RsiUserLinkService.manuallyVerify
 *
 * Verifies the updated return type (RsiUserLink | null instead of boolean)
 * and the core verification logic.
 */

import { RsiUserLinkService } from '../../services/external/RsiUserLinkService';

// Mock database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      create: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOne: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    })),
  },
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Minimal RsiUserLink-like object
const makeMockLink = (overrides: Record<string, unknown> = {}) => ({
  id: 'link-001',
  rsiHandle: 'TestPilot',
  isVerified: false,
  verifiedAt: null,
  markVerified: jest.fn(function (this: Record<string, unknown>) {
    this.isVerified = true;
    this.verifiedAt = new Date();
  }),
  ...overrides,
});

describe('RsiUserLinkService.manuallyVerify', () => {
  let service: RsiUserLinkService;
  let mockRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    const { AppDataSource } = jest.requireMock('../../config/database') as {
      AppDataSource: { getRepository: jest.Mock };
    };
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      create: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
    AppDataSource.getRepository.mockReturnValue(mockRepo);
    service = new RsiUserLinkService();
  });

  it('should return null when the link does not exist', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    const result = await service.manuallyVerify('nonexistent-id');

    expect(result).toBeNull();
    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it('should mark the link as verified and return the updated link', async () => {
    const mockLink = makeMockLink();
    mockRepo.findOne.mockResolvedValue(mockLink);
    mockRepo.save.mockImplementation((entity: unknown) => Promise.resolve(entity));

    const result = await service.manuallyVerify('link-001');

    expect(mockLink.markVerified).toHaveBeenCalled();
    expect(mockRepo.save).toHaveBeenCalledWith(mockLink);
    expect(result).toBe(mockLink);
    expect(result?.isVerified).toBe(true);
  });

  it('should return the link object (truthy) on success, not a boolean', async () => {
    const mockLink = makeMockLink();
    mockRepo.findOne.mockResolvedValue(mockLink);
    mockRepo.save.mockResolvedValue(mockLink);

    const result = await service.manuallyVerify('link-001');

    // The return type must be RsiUserLink | null, not boolean
    expect(typeof result).not.toBe('boolean');
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('rsiHandle');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
