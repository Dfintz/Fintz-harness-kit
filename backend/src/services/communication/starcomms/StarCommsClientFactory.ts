import axios, { AxiosInstance } from 'axios';

import {
  StarCommsAcarsRequest,
  StarCommsAssignmentBulkRequest,
  StarCommsClient,
  StarCommsConnectionConfig,
  StarCommsMetricsWindowRequest,
  StarCommsOpenOperationRequest,
} from './StarCommsTypes';

interface StarCommsSdkClient {
  getStatus?: () => Promise<unknown>;
  status?: () => Promise<unknown>;
  getMetrics?: (params?: Record<string, unknown>) => Promise<unknown>;
  metrics?: (params?: Record<string, unknown>) => Promise<unknown>;
}

interface StarCommsSdkModule {
  createClient?: (config: Record<string, unknown>) => StarCommsSdkClient;
  StarCommClient?: new (config: Record<string, unknown>) => StarCommsSdkClient;
  default?: new (config: Record<string, unknown>) => StarCommsSdkClient;
}

export type StarCommsModuleLoader = () => Promise<StarCommsSdkModule>;

type CreateHttpClient = (baseUrl: string, timeoutMs: number, apiKey?: string) => AxiosInstance;

const defaultModuleLoader: StarCommsModuleLoader = async () =>
  (await import('@30k/starcomm-client')) as unknown as StarCommsSdkModule;

const defaultCreateHttpClient: CreateHttpClient = (
  baseUrl: string,
  timeoutMs: number,
  apiKey?: string
): AxiosInstance => {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return axios.create({
    baseURL: baseUrl,
    timeout: timeoutMs,
    headers,
  });
};

export class StarCommsClientFactory {
  constructor(
    private readonly moduleLoader: StarCommsModuleLoader = defaultModuleLoader,
    private readonly createHttpClient: CreateHttpClient = defaultCreateHttpClient
  ) {}

  public normalizeBaseUrl(baseUrl: string): string {
    const normalized = new URL(baseUrl);
    normalized.pathname = normalized.pathname.replace(/\/$/, '');
    return normalized.toString();
  }

  public async createClient(config: StarCommsConnectionConfig): Promise<StarCommsClient> {
    const timeoutMs = config.timeoutMs ?? 5000;
    const baseUrl = this.normalizeBaseUrl(config.baseUrl);
    const httpClient = this.createHttpClient(baseUrl, timeoutMs, config.apiKey);
    const sdkClient = await this.tryCreateSdkClient(baseUrl, timeoutMs, config.apiKey);

    return {
      getStatus: async (): Promise<Record<string, unknown>> => {
        if (sdkClient) {
          const sdkStatus = await this.callSdkStatus(sdkClient);
          if (sdkStatus) {
            return sdkStatus;
          }
        }

        const response = await httpClient.get('/status');
        return this.toRecord(response.data);
      },

      getMetrics: async (
        params: StarCommsMetricsWindowRequest
      ): Promise<Record<string, unknown>> => {
        if (sdkClient) {
          const sdkMetrics = await this.callSdkMetrics(sdkClient, params);
          if (sdkMetrics) {
            return sdkMetrics;
          }
        }

        const response = await httpClient.get('/metrics', { params });
        return this.toRecord(response.data);
      },

      openOperation: async (
        req: StarCommsOpenOperationRequest
      ): Promise<Record<string, unknown>> => {
        const response = await httpClient.post('/api/v1/operation', req);
        return this.toRecord(response.data);
      },

      bulkAssign: async (req: StarCommsAssignmentBulkRequest): Promise<Record<string, unknown>> => {
        const response = await httpClient.post('/api/v1/assignments/bulk', req);
        return this.toRecord(response.data);
      },

      broadcastAcars: async (req: StarCommsAcarsRequest): Promise<Record<string, unknown>> => {
        const response = await httpClient.post('/api/v1/acars', req);
        return this.toRecord(response.data);
      },
    };
  }

  private async tryCreateSdkClient(
    baseUrl: string,
    timeoutMs: number,
    apiKey?: string
  ): Promise<StarCommsSdkClient | null> {
    try {
      const sdkModule = await this.moduleLoader();
      const config: Record<string, unknown> = {
        baseUrl,
        timeout: timeoutMs,
      };

      if (apiKey) {
        config.apiKey = apiKey;
      }

      if (sdkModule.createClient) {
        return sdkModule.createClient(config);
      }

      if (sdkModule.StarCommClient) {
        return new sdkModule.StarCommClient(config);
      }

      if (sdkModule.default) {
        return new sdkModule.default(config);
      }

      return null;
    } catch {
      return null;
    }
  }

  private async callSdkStatus(client: StarCommsSdkClient): Promise<Record<string, unknown> | null> {
    if (client.getStatus) {
      return this.toRecord(await client.getStatus());
    }
    if (client.status) {
      return this.toRecord(await client.status());
    }
    return null;
  }

  private async callSdkMetrics(
    client: StarCommsSdkClient,
    params: StarCommsMetricsWindowRequest
  ): Promise<Record<string, unknown> | null> {
    const metricsParams = { ...params } as Record<string, unknown>;
    if (client.getMetrics) {
      return this.toRecord(await client.getMetrics(metricsParams));
    }
    if (client.metrics) {
      return this.toRecord(await client.metrics(metricsParams));
    }
    return null;
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }
}
