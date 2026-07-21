import { Repository } from 'typeorm';

import { OptionalTenantEntity } from '../../../models/base/OptionalTenantEntity';
import { TenantEntity } from '../../../models/base/TenantEntity';
import { TenantService } from '../TenantService';

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

class TestTenantService extends TenantService<TenantEntity | OptionalTenantEntity> {
  constructor() {
    const repository = {
      metadata: { name: 'TestEntity' },
      query: jest.fn().mockResolvedValue([{ ok: 1 }]),
    } as unknown as Repository<TenantEntity | OptionalTenantEntity>;

    super(repository, {
      enableCache: true,
      cacheTTL: 300,
      cacheCheckPeriod: 60,
    });
  }

  public cacheSet(key: string, value: unknown): void {
    this.setInCache(key, value);
  }

  public cacheGet<T>(key: string): T | undefined {
    return this.getFromCache<T>(key);
  }

  public cacheInvalidate(key: string): void {
    this.invalidateCache(key);
  }

  public cacheInvalidateOrg(organizationId: string): void {
    this.invalidateOrgCache(organizationId);
  }

  public cacheInvalidateAll(): void {
    this.invalidateAllCache();
  }

  public entityCacheKey(organizationId: string, id: string): string {
    return this.getCacheKey(organizationId, id);
  }

  public listCacheKey(organizationId: string, suffix?: string): string {
    return this.getListCacheKey(organizationId, suffix);
  }
}

describe('TenantService cache index invalidation', () => {
  let service: TestTenantService;

  beforeEach(() => {
    service = new TestTenantService();
  });

  afterEach(() => {
    service.cacheInvalidateAll();
  });

  it('invalidates only target org keys without scanning global cache keys', () => {
    const orgAEntityKey = service.entityCacheKey('org-a', '1');
    const orgAListKey = service.listCacheKey('org-a', 'summary');
    const orgBEntityKey = service.entityCacheKey('org-b', '1');

    service.cacheSet(orgAEntityKey, { name: 'org-a entity' });
    service.cacheSet(orgAListKey, { total: 42 });
    service.cacheSet(orgBEntityKey, { name: 'org-b entity' });

    const keysSpy = jest.spyOn(
      (service as unknown as { cache: { keys: () => string[] } }).cache,
      'keys'
    );

    service.cacheInvalidateOrg('org-a');

    expect(service.cacheGet(orgAEntityKey)).toBeUndefined();
    expect(service.cacheGet(orgAListKey)).toBeUndefined();
    expect(service.cacheGet(orgBEntityKey)).toEqual({ name: 'org-b entity' });
    expect(keysSpy).not.toHaveBeenCalled();
  });

  it('keeps org index consistent when individual keys are invalidated first', () => {
    const orgKey1 = service.entityCacheKey('org-z', '1');
    const orgKey2 = service.entityCacheKey('org-z', '2');

    service.cacheSet(orgKey1, { id: 1 });
    service.cacheSet(orgKey2, { id: 2 });

    service.cacheInvalidate(orgKey1);
    service.cacheInvalidateOrg('org-z');

    expect(service.cacheGet(orgKey1)).toBeUndefined();
    expect(service.cacheGet(orgKey2)).toBeUndefined();
  });

  it('clears index on full cache flush', () => {
    const orgKey = service.entityCacheKey('org-clear', '1');

    service.cacheSet(orgKey, { id: 1 });
    service.cacheInvalidateAll();

    expect(() => service.cacheInvalidateOrg('org-clear')).not.toThrow();
    expect(service.cacheGet(orgKey)).toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

