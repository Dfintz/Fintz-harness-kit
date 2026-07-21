/**
 * LootOcrService Tests
 *
 * Exercises the OCR fallback behaviour and the line-parsing heuristics that turn
 * Azure Vision text into loot item suggestions.
 */

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { LootOcrService } from '../../services/loot/LootOcrService';

describe('LootOcrService', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  const azureResponse = (lines: string[]): unknown => ({
    readResult: {
      blocks: [{ lines: lines.map(text => ({ text })) }],
    },
  });

  it('returns disabled result when not configured', async () => {
    delete process.env.AZURE_VISION_ENDPOINT;
    delete process.env.AZURE_VISION_KEY;
    const service = new LootOcrService();

    const result = await service.extractItems(Buffer.from('x'));

    expect(result.enabled).toBe(false);
    expect(result.suggestions).toHaveLength(0);
    expect(service.isConfigured()).toBe(false);
  });

  it('parses quantities and categories from OCR lines', async () => {
    process.env.AZURE_VISION_ENDPOINT = 'https://vision.example.com';
    process.env.AZURE_VISION_KEY = 'secret';

    const lines = [
      'Medical Supplies x3',
      '2x Titanium',
      'Ballistic Rifle',
      'Quantum Drive 5',
      '12345', // pure number — skipped
    ];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(azureResponse(lines)),
    }) as unknown as typeof fetch;

    const service = new LootOcrService();
    const result = await service.extractItems(Buffer.from('img'));

    expect(result.enabled).toBe(true);
    const byName = Object.fromEntries(result.suggestions.map(s => [s.name, s]));

    expect(byName['Medical Supplies']?.quantity).toBe(3);
    expect(byName['Titanium']?.quantity).toBe(2);
    expect(byName['Titanium']?.category).toBe('commodity');
    expect(byName['Ballistic Rifle']?.quantity).toBe(1);
    expect(byName['Ballistic Rifle']?.category).toBe('weapon');
    expect(byName['Quantum Drive']?.quantity).toBe(5);
    // The pure-number line is dropped.
    expect(result.suggestions.find(s => s.name === '12345')).toBeUndefined();
  });

  it('degrades gracefully when the OCR request fails', async () => {
    process.env.AZURE_VISION_ENDPOINT = 'https://vision.example.com';
    process.env.AZURE_VISION_KEY = 'secret';
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('boom'),
    }) as unknown as typeof fetch;

    const service = new LootOcrService();
    const result = await service.extractItems(Buffer.from('img'));

    expect(result.enabled).toBe(true);
    expect(result.suggestions).toHaveLength(0);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
