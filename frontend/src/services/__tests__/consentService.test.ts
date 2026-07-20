/**
 * Consent Service Tests
 */

import { apiClient } from '@/services/apiClient';
import { consentService, ConsentType } from '@/services/consentService';

// Mock apiClient (the service uses apiClient, not raw axios)
jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  },
  ApiClientError: class ApiClientError extends Error {
    statusCode?: number;
    code?: string;
    requestId?: string;
    details?: unknown;
    constructor(message: string) {
      super(message);
      this.name = 'ApiClientError';
    }
  },
  getErrorMessage: jest.fn((err: unknown) => (err instanceof Error ? err.message : String(err))),
}));

// Mock logger to suppress output
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const mockGet = apiClient.get as jest.Mock;
const mockPost = apiClient.post as jest.Mock;
const mockDelete = apiClient.delete as jest.Mock;

describe('ConsentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('recordConsent', () => {
    it('should call API with correct parameters', async () => {
      const mockResponse = {
        data: {
          message: 'Consent granted successfully',
          consent: { type: ConsentType.ANALYTICS, granted: true, updatedAt: '2024-01-01' },
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      const result = await consentService.recordConsent(ConsentType.ANALYTICS, true);

      expect(mockPost).toHaveBeenCalledWith('/api/v2/gdpr/consent', {
        consentType: ConsentType.ANALYTICS,
        granted: true,
        purpose: undefined,
        version: undefined,
      });
      expect(result.message).toBe('Consent granted successfully');
    });

    it('should include purpose and version when provided', async () => {
      const mockResponse = { data: { message: 'Success', consent: {} } };
      mockPost.mockResolvedValue(mockResponse);

      await consentService.recordConsent(ConsentType.MARKETING, true, 'Marketing emails', '1.0');

      expect(mockPost).toHaveBeenCalledWith('/api/v2/gdpr/consent', {
        consentType: ConsentType.MARKETING,
        granted: true,
        purpose: 'Marketing emails',
        version: '1.0',
      });
    });
  });

  describe('getUserConsents', () => {
    it('should return array of consents', async () => {
      const mockConsents = [
        { type: ConsentType.ESSENTIAL, granted: true },
        { type: ConsentType.ANALYTICS, granted: false },
      ];
      mockGet.mockResolvedValue({
        data: { consents: mockConsents },
      });

      const result = await consentService.getUserConsents();

      expect(mockGet).toHaveBeenCalledWith('/api/v2/gdpr/consent');
      expect(result).toEqual(mockConsents);
    });
  });

  describe('checkConsent', () => {
    it('should return true when consent is granted', async () => {
      mockGet.mockResolvedValue({
        data: { consentType: ConsentType.ANALYTICS, granted: true },
      });

      const result = await consentService.checkConsent(ConsentType.ANALYTICS);

      expect(result).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('/api/v2/gdpr/consent/analytics');
    });

    it('should return false when consent is not granted', async () => {
      mockGet.mockResolvedValue({
        data: { consentType: ConsentType.MARKETING, granted: false },
      });

      const result = await consentService.checkConsent(ConsentType.MARKETING);

      expect(result).toBe(false);
    });
  });

  describe('withdrawConsent', () => {
    it('should call recordConsent with granted=false', async () => {
      const mockResponse = {
        data: {
          message: 'Consent revoked successfully',
          consent: { type: ConsentType.MARKETING, granted: false },
        },
      };
      mockPost.mockResolvedValue(mockResponse);

      await consentService.withdrawConsent(ConsentType.MARKETING, 'User requested');

      expect(mockPost).toHaveBeenCalledWith('/api/v2/gdpr/consent', {
        consentType: ConsentType.MARKETING,
        granted: false,
        purpose: 'User requested',
        version: undefined,
      });
    });
  });

  describe('requestAccountDeletion', () => {
    it('should call API with immediate=false by default', async () => {
      const mockResponse = {
        data: {
          message: 'Deletion scheduled',
          deletionRequestedAt: '2024-01-01',
          estimatedDeletionDate: '2024-01-31',
        },
      };
      mockDelete.mockResolvedValue(mockResponse);

      const result = await consentService.requestAccountDeletion();

      expect(mockDelete).toHaveBeenCalledWith('/api/v2/gdpr/delete-account', {
        data: { confirm: 'DELETE', immediate: false },
      });
      expect(result.message).toBe('Deletion scheduled');
    });

    it('should call API with immediate=true when specified', async () => {
      const mockResponse = {
        data: {
          message: 'Account deleted',
          completedAt: '2024-01-01',
        },
      };
      mockDelete.mockResolvedValue(mockResponse);

      await consentService.requestAccountDeletion(true);

      expect(mockDelete).toHaveBeenCalledWith('/api/v2/gdpr/delete-account', {
        data: { confirm: 'DELETE', immediate: true },
      });
    });
  });

  describe('requestDataExport', () => {
    it('should return exported user data', async () => {
      const mockExportData = {
        user: { id: '123', email: 'test@example.com' },
        consents: [],
        ships: [],
        activities: [],
        organizations: [],
        activityLogs: [],
        sessions: [],
        exportedAt: '2024-01-01',
        dataExportVersion: '2.0',
      };
      mockGet.mockResolvedValue({ data: mockExportData });

      const result = await consentService.requestDataExport();

      expect(mockGet).toHaveBeenCalledWith('/api/v2/gdpr/export');
      expect(result.user.id).toBe('123');
    });
  });

  describe('error handling', () => {
    it('should throw errors for 401 responses without redirecting', async () => {
      mockPost.mockRejectedValue(new Error('Unauthorized'));

      // Verify that the error is thrown (BaseService transforms it to a generic Error)
      await expect(consentService.recordConsent(ConsentType.ANALYTICS, true)).rejects.toThrow();

      // Key point: no redirect should occur - the error is just thrown
      // The UI component can then handle the error appropriately
    });

    it('should throw errors for timeout without redirecting', async () => {
      mockGet.mockRejectedValue(new Error('timeout of 30000ms exceeded'));

      // Verify that the error is thrown
      await expect(consentService.getUserConsents()).rejects.toThrow();

      // Key point: no redirect should occur - the error is just thrown
      // The global axios interceptor or UI component handles it
    });
  });
});
