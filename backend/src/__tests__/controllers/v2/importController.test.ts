import { Response } from 'express';

import { ImportController } from '../../../controllers/v2/importController';
import { AuthRequest } from '../../../middleware/auth';

const mockImportData = jest.fn();
const mockGetData = jest.fn();
const mockDeleteData = jest.fn();
const mockParseJson = jest.fn();

jest.mock('../../../services/user/SCStatsImportService', () => ({
  SCStatsImportService: jest.fn().mockImplementation(() => ({
    importData: mockImportData,
    getData: mockGetData,
    deleteData: mockDeleteData,
    parseJSON: mockParseJson,
  })),
}));

jest.mock('../../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ImportController', () => {
  let controller: ImportController;
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ImportController();

    req = {
      user: {
        id: 'user-1',
        username: 'pilot',
        role: 'user',
      },
      body: {},
      query: {},
      params: {},
      headers: {},
    } as Partial<AuthRequest>;

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as Partial<Response>;
  });

  describe('create', () => {
    it('returns guidance error for generic CSV create requests', async () => {
      req.body = {
        source: 'generic_csv',
        consentGranted: true,
      };

      await controller.create(req as AuthRequest, res as Response);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('Generic CSV import persistence is not enabled yet'),
        })
      );
      expect(mockImportData).not.toHaveBeenCalled();
    });

    it('imports SCStats JSON when source is scstats_json', async () => {
      mockImportData.mockResolvedValueOnce({
        imported: true,
      });
      req.body = {
        source: 'scstats_json',
        consentGranted: true,
        jsonData: '{"metadata":{"version":"1"}}',
      };

      await controller.create(req as AuthRequest, res as Response);

      expect(mockImportData).toHaveBeenCalledWith('user-1', '{"metadata":{"version":"1"}}', true);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ imported: true }),
        })
      );
    });
  });

  describe('validate', () => {
    it('returns CSV preview metadata for generic CSV validation', async () => {
      req.body = {
        source: 'generic_csv',
        csvData: 'name,ship\nalice,gladius\nbob,vulture',
      };

      await controller.validate(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: true,
            source: 'generic_csv',
            preview: expect.objectContaining({
              columns: ['name', 'ship'],
              rowCount: 2,
            }),
          }),
        })
      );
    });

    it('returns validation guidance for scstats_csv source', async () => {
      req.body = {
        source: 'scstats_csv',
      };

      await controller.validate(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: true,
            source: 'scstats_csv',
            expectedFiles: ['playtime', 'loadoutTop', 'loadoutDetail', 'purchases', 'ships'],
          }),
        })
      );
    });

    it('returns invalid validation result for malformed generic CSV', async () => {
      req.body = {
        source: 'generic_csv',
        csvData: '',
      };

      await controller.validate(req as AuthRequest, res as Response);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            valid: false,
          }),
        })
      );
    });
  });
});
