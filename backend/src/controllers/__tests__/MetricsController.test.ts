/**
 * Tests for Metrics Controller
 */

import { Request, Response } from 'express';
import { trackWebVitals, getWebVitalsStats } from '../MetricsController';
import * as appInsights from '../../config/applicationInsights';

// Mock dependencies
jest.mock('../../config/applicationInsights');

describe('MetricsController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });

    mockRequest = {
      body: {},
      user: { id: 'user-123' },
    } as Partial<Request>;

    mockResponse = {
      status: mockStatus,
      json: mockJson,
    } as Partial<Response>;

    // Mock Application Insights functions
    (appInsights.trackMetric as jest.Mock) = jest.fn();
    (appInsights.trackEvent as jest.Mock) = jest.fn();
  });

  describe('trackWebVitals', () => {
    it('should successfully track valid Web Vitals metrics', async () => {
      mockRequest.body = {
        metrics: [
          {
            name: 'LCP',
            value: 2000,
            rating: 'good',
            delta: 2000,
            id: 'lcp-1',
            navigationType: 'navigate',
            timestamp: Date.now(),
            url: 'http://localhost:3000/dashboard',
            userAgent: 'Mozilla/5.0',
          },
        ],
      };

      await trackWebVitals(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Metrics tracked successfully',
        count: 1,
      });
    });

    it('should return 400 for invalid payload', async () => {
      mockRequest.body = {
        metrics: null,
      };

      await trackWebVitals(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Invalid metrics payload',
      });
    });
  });

  describe('getWebVitalsStats', () => {
    it('should return information about Web Vitals statistics', async () => {
      await getWebVitalsStats(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String),
          metrics: expect.arrayContaining([
            'webvitals.lcp',
            'webvitals.inp',
            'webvitals.cls',
            'webvitals.ttfb',
          ]),
        })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
