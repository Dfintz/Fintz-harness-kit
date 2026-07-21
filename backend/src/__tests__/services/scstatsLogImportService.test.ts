import { SCStatsLogImportService } from '../../services/user/SCStatsLogImportService';

describe('SCStatsLogImportService', () => {
  let service: SCStatsLogImportService;

  beforeEach(() => {
    service = new SCStatsLogImportService();
  });

  it('builds playtime and ships CSV from log content', () => {
    const logContent = [
      "<2026-06-18T06:47:40.268Z> Log started",
      "<2026-06-18T06:47:40.268Z> [Trace] @env_session:  'pub-sc-alpha-480-11825000'",
      "<2026-06-18T06:48:10.000Z> granted control token for 'MISC_Prospector_1' [123]",
      "<2026-06-18T06:58:10.000Z> releasing control token for 'MISC_Prospector_1' [123]",
      "<2026-06-18T07:17:40.268Z> session end",
    ].join('\n');

    const result = service.buildCsvImports([
      {
        name: 'Game.log',
        content: logContent,
      },
    ]);

    expect(result.csvFiles.playtime).toContain('Version,Hours,Builds');
    expect(result.csvFiles.playtime).toContain('Alpha 4.8.0 LIVE');

    expect(result.csvFiles.ships).toContain('Ship,Total Time,Sessions,Longest Flight,First Flown,Last Flown');
    expect(result.csvFiles.ships).toContain('MISC_Prospector');

    expect(result.meta.filesProcessed).toBe(1);
    expect(result.meta.sessionsParsed).toBe(1);
    expect(result.meta.shipSessionsParsed).toBe(1);
    expect(result.meta.categoriesExtracted).toContain('playtime');
    expect(result.meta.categoriesExtracted).toContain('ships');
  });

  it('extracts optional loadout and purchase categories when events exist', () => {
    const logContent = [
      "<2026-06-18T06:47:40.268Z> [Trace] @env_session:  'pub-sc-alpha-480-11825000'",
      "<2026-06-18T06:50:00.000Z> equipped item 'Arclight Pistol' port Weapon",
      "<2026-06-18T06:51:00.000Z> purchased item 'MedPen' for 450 aUEC",
      "<2026-06-18T06:55:00.000Z> granted control token for 'MISC_Prospector_1' [123]",
      "<2026-06-18T07:10:00.000Z> releasing control token for 'MISC_Prospector_1' [123]",
    ].join('\n');

    const result = service.buildCsvImports([
      {
        name: 'Game.log',
        content: logContent,
      },
    ]);

    expect(result.csvFiles.loadoutTop).toContain('Port,Most Worn Item,Sessions,Worn Time');
    expect(result.csvFiles.loadoutTop).toContain('Arclight Pistol');
    expect(result.csvFiles.purchases).toContain('Item,Qty,Spent,Top Shop');
    expect(result.csvFiles.purchases).toContain('MedPen');
    expect(result.meta.loadoutEventsParsed).toBeGreaterThan(0);
    expect(result.meta.purchaseEventsParsed).toBeGreaterThan(0);
    expect(result.meta.parseQuality[0]?.warnings.join(' ')).toContain('best-effort');
  });

  it('throws when no valid session timestamps are found', () => {
    expect(() =>
      service.buildCsvImports([
        {
          name: 'bad.log',
          content: 'no timestamps here',
        },
      ])
    ).toThrow('No valid sessions found in uploaded logs');
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
