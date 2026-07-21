import axios from 'axios';

import { rsiStatusService } from '../../services/external/RsiStatusService';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function mockStatusFetches(statusHtml: string, rssXml = '<rss><channel></channel></rss>'): void {
  mockedAxios.get.mockResolvedValueOnce({ data: statusHtml });
  mockedAxios.get.mockResolvedValueOnce({ data: rssXml });
}

describe('RsiStatusService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rsiStatusService.invalidateCache();
  });

  it('parses maintenance from compact component summary text', async () => {
    const html = `
      <html>
        <body>
          PlatformOperational Persistent UniverseMaintenance Arena CommanderMaintenance
        </body>
      </html>
    `;

    mockStatusFetches(html);

    const snapshot = await rsiStatusService.getStatus();
    const statuses = new Map(
      snapshot.components.map(component => [component.name, component.status])
    );

    expect(statuses.get('Platform')).toBe('Operational');
    expect(statuses.get('Persistent Universe')).toBe('Maintenance');
    expect(statuses.get('Arena Commander')).toBe('Maintenance');
    expect(snapshot.overallStatus).toBe('Degraded');
  });

  it('preserves partial outage classification', async () => {
    const html = `
      <html>
        <body>
          PlatformOperational Persistent UniversePartial Outage Arena CommanderOperational
        </body>
      </html>
    `;

    mockStatusFetches(html);

    const snapshot = await rsiStatusService.getStatus();
    const statuses = new Map(
      snapshot.components.map(component => [component.name, component.status])
    );

    expect(statuses.get('Persistent Universe')).toBe('Partial Outage');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
