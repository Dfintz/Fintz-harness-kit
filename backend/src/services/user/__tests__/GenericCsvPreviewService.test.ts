import { GenericCsvPreviewService } from '../GenericCsvPreviewService';

describe('GenericCsvPreviewService', () => {
  let service: GenericCsvPreviewService;

  beforeEach(() => {
    service = new GenericCsvPreviewService();
  });

  it('returns preview metadata for valid CSV input', () => {
    const csvData =
      'name,ship\nalice,gladius\nbob,vulture\ncharlie,cutter\ndelta,carrack\necho,arrow';

    const preview = service.parsePreview(csvData);

    expect(preview.columns).toEqual(['name', 'ship']);
    expect(preview.rowCount).toBe(5);
    expect(preview.sampleRows).toHaveLength(5);
    expect(preview.sampleRows[0]).toEqual({ name: 'alice', ship: 'gladius' });
  });

  it('throws a validation error when CSV payload is empty', () => {
    expect(() => service.parsePreview('')).toThrow('csvData is required for source generic_csv');
  });

  it('throws when CSV header row is missing', () => {
    expect(() => service.parsePreview(',ship\nalice,gladius')).toThrow(
      'CSV header row is required'
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

