import {
  ExternalIntegration,
  IntegrationType,
  SyncDirection,
} from '../../../../models/ExternalIntegration';
import { StarCommsAdapter } from '../../../../services/communication/starcomms/StarCommsAdapter';
import { StarCommsClientFactory } from '../../../../services/communication/starcomms/StarCommsClientFactory';

describe('StarCommsAdapter', () => {
  const createIntegration = (): ExternalIntegration =>
    ({
      id: 'integration-123',
      fleetId: 'fleet-123',
      name: 'StarComms',
      type: IntegrationType.STARCOMMS,
      syncDirection: SyncDirection.INBOUND,
      authConfig: { type: 'none' },
      starCommsConfig: { baseUrl: 'https://starcomms.example.com', shardId: 'alpha' },
      fieldMappings: [],
      autoSync: false,
      syncHistory: [],
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      syncedCategories: [],
      enabled: true,
      createdBy: 'user-123',
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active' as never,
    }) as ExternalIntegration;

  it('should map status payload to normalized snapshot', async () => {
    const mockClientFactory = {
      createClient: jest.fn(async () => ({
        getStatus: jest.fn(async () => ({
          status: 'healthy',
          connectedUsers: 42,
          channels: 7,
          updatedAt: '2026-07-12T00:00:00.000Z',
        })),
        getMetrics: jest.fn(async () => ({ attendanceRate: 0.9 })),
      })),
    } as unknown as StarCommsClientFactory;

    const adapter = new StarCommsAdapter(mockClientFactory);
    const status = await adapter.getShardStatus({ baseUrl: 'https://starcomms.example.com' });

    expect(status.status).toBe('healthy');
    expect(status.connectedUsers).toBe(42);
    expect(status.channels).toBe(7);
  });

  it('should build connection config from integration model', () => {
    const adapter = new StarCommsAdapter({} as StarCommsClientFactory);
    const integration = createIntegration();

    const config = adapter.buildConnectionConfig(integration);

    expect(config.baseUrl).toBe('https://starcomms.example.com');
    expect(config.shardId).toBe('alpha');
  });

  it('should return metrics snapshot with supplied window', async () => {
    const mockClientFactory = {
      createClient: jest.fn(async () => ({
        getStatus: jest.fn(async () => ({ status: 'healthy' })),
        getMetrics: jest.fn(async () => ({
          attendanceRate: 0.75,
          activeParticipants: 15,
          avgSessionMinutes: 31,
        })),
      })),
    } as unknown as StarCommsClientFactory;

    const adapter = new StarCommsAdapter(mockClientFactory);
    const metrics = await adapter.getMetricsWindow(
      { baseUrl: 'https://starcomms.example.com' },
      { windowMinutes: 30 }
    );

    expect(metrics.attendanceRate).toBe(0.75);
    expect(metrics.activeParticipants).toBe(15);
    expect(metrics.window.windowMinutes).toBe(30);
  });
});
