/**
 * OpenAPI Endpoint Response Validation Tests
 *
 * These tests verify that actual API responses match the OpenAPI specification.
 * They test a representative set of endpoints to ensure:
 * 1. Response status codes match the spec
 * 2. Response schemas match the spec
 * 3. Response headers match the spec
 * 4. Error responses conform to the spec
 *
 * Note: These tests require a running backend server.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { AxiosInstance } from 'axios';
import axios from 'axios';
import * as fs from 'fs';
import YAML from 'js-yaml';
import * as path from 'path';

// Check if OpenAPI spec exists
const specPath = path.resolve(__dirname, '../../openapi/bundled.yaml');
const specExists = fs.existsSync(specPath);

const describeIf = specExists ? describe : describe.skip;

describeIf('OpenAPI Endpoint Response Validation', () => {
  let apiClient: AxiosInstance;
  let spec: any;
  let ajv: Ajv;
  let schemas: Map<string, Ajv.ValidateFunction>;
  const apiBaseUrl = process.env.API_URL || 'http://localhost:3000';

  // Skip these tests if server is not running
  const skipIfServerNotRunning = process.env.SKIP_INTEGRATION_TESTS === 'true';

  beforeAll(async () => {
    // Load OpenAPI spec
    const specPath = path.resolve(__dirname, '../../openapi/bundled.yaml');
    if (!fs.existsSync(specPath)) {
      throw new Error(`OpenAPI spec not found at ${specPath}`);
    }

    const specContent = fs.readFileSync(specPath, 'utf-8');
    spec = YAML.load(specContent) as any;

    // Initialize AJV
    ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
    });
    addFormats(ajv);

    // Compile schemas
    schemas = new Map();
    if (spec.components?.schemas) {
      Object.entries(spec.components.schemas).forEach(([name, schema]) => {
        try {
          schemas.set(name, ajv.compile(schema as any));
        } catch (error) {
          console.warn(`Warning: Failed to compile schema ${name}`);
        }
      });
    }

    // Initialize HTTP client
    apiClient = axios.create({
      baseURL: apiBaseUrl,
      validateStatus: () => true, // Don't throw on any status code
    });

    // Check if server is running (skip tests if not)
    if (!skipIfServerNotRunning) {
      try {
        await apiClient.get('/api/health');
      } catch (error) {
        console.warn(
          `⚠️  Backend server not running at ${apiBaseUrl}. Response validation tests will be skipped.`
        );
      }
    }
  });

  describe('Health Endpoint', () => {
    it('GET /api/health should return 200 with valid response', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/health');

      // Should return 200
      expect(response.status).toBe(200);

      // Should have valid structure
      expect(response.data).toBeDefined();
      expect(response.data.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy'].includes(response.data.status)).toBe(true);
    });

    it('GET /api/health/system should return 200 with system health', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      try {
        const response = await apiClient.get('/api/health/system');

        // Should return 200 or be properly defined
        expect(response.status).toBeLessThan(400);
        expect(response.data).toBeDefined();
      } catch (error: unknown) {
        // It's OK if this endpoint doesn't exist
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status !== 404) {
          throw error;
        }
      }
    });
  });

  describe('Authentication Endpoints', () => {
    it('POST /api/auth/logout should return 200 or 401', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.post('/api/auth/logout');

      // Should return 200, 401, or 403 depending on auth status
      expect([200, 401, 403].includes(response.status)).toBe(true);

      // Error responses should follow ApiError schema
      if (response.status >= 400) {
        expect(response.data.code).toBeDefined();
        expect(response.data.message).toBeDefined();
      }
    });

    it('POST /api/auth/refresh should require valid token', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.post(
        '/api/auth/refresh',
        {},
        {
          headers: {
            Authorization: 'Bearer invalid-token',
          },
        }
      );

      // Should return error
      expect([400, 401, 403].includes(response.status)).toBe(true);

      // Error responses should follow ApiError schema
      expect(response.data.code).toBeDefined();
      expect(response.data.message).toBeDefined();
    });
  });

  describe('User Endpoints', () => {
    it('GET /api/v2/users/me without auth should return 401', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/v2/users/me');

      // Should require authentication
      expect([401, 403].includes(response.status)).toBe(true);

      // Should have proper error format
      expect(response.data.code).toBeDefined();
      expect(response.data.message).toBeDefined();
    });

    it('GET /api/v2/users/{userId} should handle missing user properly', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/v2/users/non-existent-user-id');

      // Should return 401 or 404
      expect([401, 404].includes(response.status)).toBe(true);

      if (response.status === 404) {
        // Error responses should follow ApiError schema
        expect(response.data.code).toBeDefined();
        expect(response.data.message).toBeDefined();
      }
    });
  });

  describe('Endpoint Method Validation', () => {
    it('OPTIONS requests should return 200 for CORS-enabled endpoints', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      try {
        const response = await apiClient.options('/api/health');
        expect(response.status).toBe(200);
      } catch (error: unknown) {
        // Some servers might not support OPTIONS
        const axiosError = error as { response?: { status?: number } };
        expect([200, 405].includes(axiosError.response?.status ?? 0)).toBe(true);
      }
    });

    it('Unsupported methods should return 405 or error', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      try {
        const response = await apiClient.patch('/api/health');
        // Either not found or method not allowed
        expect(response.status >= 400).toBe(true);
      } catch (error: unknown) {
        // Expected behavior
        const axiosError = error as { response?: { status?: number } };
        expect((axiosError.response?.status ?? 0) >= 400).toBe(true);
      }
    });
  });

  describe('Error Response Format Validation', () => {
    it('should return proper error format for 401 responses', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/v2/users/me', {
        validateStatus: () => true,
      });

      if (response.status === 401) {
        // Validate against ApiError schema
        const validateError = schemas.get('ApiError');
        if (validateError) {
          expect(validateError(response.data)).toBe(true);
        }

        // Should have required fields
        expect(response.data.status).toBe('error');
        expect(response.data.code).toBeDefined();
        expect(response.data.message).toBeDefined();
      }
    });

    it('should return proper error format for 404 responses', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/nonexistent-endpoint', {
        validateStatus: () => true,
      });

      expect(response.status).toBe(404);

      // Should have error structure
      expect(response.data).toBeDefined();
    });

    it('should return proper error format for validation errors', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.post(
        '/api/auth/logout',
        { invalidField: 'test' },
        {
          validateStatus: () => true,
        }
      );

      // Error responses should have proper structure
      if (response.status >= 400) {
        expect(response.data).toBeDefined();
        expect(response.data.code || response.data.message).toBeDefined();
      }
    });
  });

  describe('Response Header Validation', () => {
    it('responses should include proper content-type headers', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/health');

      expect(response.headers['content-type']).toBeDefined();
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('responses should include CORS headers', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/health', {
        headers: {
          Origin: 'http://localhost:5173',
        },
      });

      // CORS headers might be present
      expect(response.headers['access-control-allow-origin'] !== undefined).toBe(true);
    });
  });

  describe('Response Data Structure', () => {
    it('health endpoint should return object with required fields', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/health');

      expect(typeof response.data).toBe('object');
      expect(response.data).not.toBeNull();
      expect(response.data.status).toBeDefined();
    });

    it('error responses should not have circular references', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/v2/users/me');

      // Should be serializable
      expect(() => JSON.stringify(response.data)).not.toThrow();
    });
  });

  describe('Endpoint Availability', () => {
    it('should have health endpoint available without authentication', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const response = await apiClient.get('/api/health');

      // Health endpoint should always be available
      expect(response.status).toBeLessThan(400);
    });

    it('should handle concurrent requests properly', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const requests = Array(5)
        .fill(null)
        .map(() => apiClient.get('/api/health'));

      const responses = await Promise.all(requests);

      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBeLessThan(400);
      });
    });
  });

  describe('Performance and Timeouts', () => {
    it('health endpoint should respond within reasonable time', async () => {
      if (skipIfServerNotRunning) {
        console.log('Skipping - server not running');
        return;
      }

      const startTime = Date.now();
      await apiClient.get('/api/health');
      const endTime = Date.now();

      // Health check should be fast (< 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
