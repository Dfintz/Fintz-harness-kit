import type { Response } from 'express';

export interface MockOrgQueryBuilder {
  where: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  getOne: jest.Mock;
}

export interface MockOrgRepository {
  createQueryBuilder: jest.Mock;
}

export interface MockOrganizationContext {
  mockOrgQueryBuilder: MockOrgQueryBuilder;
  mockOrgRepository: MockOrgRepository;
}

export function createMockOrganizationContext(defaultOrg?: {
  id: string;
  name: string;
}): MockOrganizationContext {
  const resolvedOrg = defaultOrg ?? { id: 'org-123', name: 'Test Org' };

  const mockOrgQueryBuilder: MockOrgQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(resolvedOrg),
  };

  const mockOrgRepository: MockOrgRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(mockOrgQueryBuilder),
  };

  return {
    mockOrgQueryBuilder,
    mockOrgRepository,
  };
}

export function createStandardMockResponse(options?: {
  includePaginated?: boolean;
}): Partial<Response> {
  const mockResponse: Partial<Response> = {
    success: jest.fn(),
    json: jest.fn(),
    status: jest.fn().mockReturnThis(),
  };

  if (options?.includePaginated) {
    mockResponse.paginated = jest.fn();
  }

  return mockResponse;
}

export function shutdownEnhancedCacheService(): void {
  const { enhancedCacheService } = require('../../../services/caching/EnhancedCacheService');
  enhancedCacheService.shutdown();
}
