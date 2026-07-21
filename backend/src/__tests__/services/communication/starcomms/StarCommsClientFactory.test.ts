import { AxiosInstance } from 'axios';

import { StarCommsClientFactory } from '../../../../services/communication/starcomms/StarCommsClientFactory';

describe('StarCommsClientFactory', () => {
  it('should normalize base URL and call sdk client status when available', async () => {
    const mockSdkClient = {
      getStatus: jest.fn(async () => ({ status: 'healthy' })),
    };

    const moduleLoader = jest.fn(async () => ({
      createClient: () => mockSdkClient,
    }));

    const mockHttpClient = {
      get: jest.fn(async () => ({ data: { status: 'offline' } })),
    } as unknown as AxiosInstance;

    const createHttpClient = jest.fn(() => mockHttpClient);
    const factory = new StarCommsClientFactory(moduleLoader, createHttpClient);

    const client = await factory.createClient({
      baseUrl: 'https://starcomms.example.com/',
      timeoutMs: 9000,
    });

    const status = await client.getStatus();

    expect(createHttpClient).toHaveBeenCalledWith(
      'https://starcomms.example.com/',
      9000,
      undefined
    );
    expect(status).toEqual({ status: 'healthy' });
  });

  it('should fallback to http client metrics when sdk unavailable', async () => {
    const moduleLoader = jest.fn(async () => {
      throw new Error('module unavailable');
    });

    const mockHttpClient = {
      get: jest.fn(async () => ({ data: { attendanceRate: 0.8 } })),
    } as unknown as AxiosInstance;

    const createHttpClient = jest.fn(() => mockHttpClient);
    const factory = new StarCommsClientFactory(moduleLoader, createHttpClient);

    const client = await factory.createClient({ baseUrl: 'https://starcomms.example.com' });
    const metrics = await client.getMetrics({ windowMinutes: 15 });

    expect(mockHttpClient.get).toHaveBeenCalledWith('/metrics', {
      params: { windowMinutes: 15 },
    });
    expect(metrics).toEqual({ attendanceRate: 0.8 });
  });
});
