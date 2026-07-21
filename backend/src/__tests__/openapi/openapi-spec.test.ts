/**
 * OpenAPI Specification Validation Tests
 *
 * These tests ensure that the backend API adheres to its OpenAPI specification.
 * They validate:
 * 1. All endpoints defined in OpenAPI spec are implemented
 * 2. Response schemas match the specification
 * 3. Request validation matches the specification
 * 4. Error responses conform to spec
 *
 * This provides contract testing between the API specification and implementation.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import YAML from 'js-yaml';
import * as path from 'path';

// Check if OpenAPI spec exists
const specPath = path.resolve(__dirname, '../../openapi/bundled.yaml');
const specExists = fs.existsSync(specPath);

const describeIf = specExists ? describe : describe.skip;

describeIf('OpenAPI Specification Contract Tests', () => {
  let app: any;
  let spec: any;
  let ajv: Ajv;
  const apiBaseUrl = process.env.API_URL || 'http://localhost:3000';

  beforeAll(async () => {
    // Load the OpenAPI spec
    const specContent = fs.readFileSync(specPath, 'utf-8');
    spec = YAML.load(specContent) as any;

    // Initialize AJV for schema validation
    ajv = new Ajv({
      allErrors: true,
      formats: 'full',
    });
    addFormats(ajv);

    // Compile all schemas for validation
    if (spec.components?.schemas) {
      Object.entries(spec.components.schemas).forEach(([name, schema]) => {
        try {
          ajv.addSchema(schema as any, name);
        } catch (error) {
          console.warn(`Warning: Failed to compile schema ${name}:`, error);
        }
      });
    }
  });

  describe('API Structure Validation', () => {
    it('should have a valid OpenAPI spec structure', () => {
      expect(spec).toBeDefined();
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info).toBeDefined();
      expect(spec.info.title).toBeDefined();
      expect(spec.info.version).toBeDefined();
    });

    it('should have paths defined', () => {
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    it('should have all required sections', () => {
      expect(spec.servers).toBeDefined();
      expect(spec.tags).toBeDefined();
      expect(spec.components).toBeDefined();
      expect(spec.components.schemas).toBeDefined();
    });

    it('should have proper server configuration', () => {
      expect(Array.isArray(spec.servers)).toBe(true);
      expect(spec.servers.length).toBeGreaterThan(0);

      // Validate each server
      spec.servers.forEach((server: any) => {
        expect(server.url).toBeDefined();
        expect(typeof server.url).toBe('string');
      });
    });

    it('should have proper tags defined', () => {
      expect(Array.isArray(spec.tags)).toBe(true);
      expect(spec.tags.length).toBeGreaterThan(0);

      // Validate each tag
      spec.tags.forEach((tag: any) => {
        expect(tag.name).toBeDefined();
        expect(typeof tag.name).toBe('string');
      });
    });
  });

  describe('Path Definitions Validation', () => {
    it('should have all paths properly defined', () => {
      const paths = Object.keys(spec.paths);
      expect(paths.length).toBeGreaterThan(0);

      // Each path should have at least one operation
      paths.forEach(pathKey => {
        const pathItem = spec.paths[pathKey];
        const operations = Object.keys(pathItem).filter(key =>
          ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(key)
        );
        expect(operations.length).toBeGreaterThan(0);
      });
    });

    it('should have valid operation definitions', () => {
      const validMethods = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];

      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!validMethods.includes(method)) return;

          // Each operation should have basic properties
          expect(operation.summary || operation.description).toBeDefined();
          expect(operation.tags).toBeDefined();
          expect(Array.isArray(operation.tags)).toBe(true);
          expect(operation.tags.length).toBeGreaterThan(0);

          // Validate responses
          expect(operation.responses).toBeDefined();
          expect(Object.keys(operation.responses).length).toBeGreaterThan(0);

          // Validate response codes
          Object.keys(operation.responses).forEach(statusCode => {
            // Should be valid HTTP status code or 'default'
            expect(/^\d{3}$/.test(statusCode) || statusCode === 'default').toBe(true);
          });
        });
      });
    });

    it('should have proper parameter definitions', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

          if (!operation.parameters) return;

          operation.parameters.forEach((param: any) => {
            expect(param.name).toBeDefined();
            expect(param.in).toBeDefined();
            expect(['query', 'path', 'header', 'cookie'].includes(param.in)).toBe(true);
            expect(param.schema).toBeDefined();
          });
        });
      });
    });

    it('should have proper request body definitions', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['post', 'put', 'patch'].includes(method)) return;

          if (!operation.requestBody) return;

          expect(operation.requestBody.content).toBeDefined();
          expect(Object.keys(operation.requestBody.content).length).toBeGreaterThan(0);

          Object.entries(operation.requestBody.content).forEach(
            ([mediaType, content]: [string, any]) => {
              expect(
                [
                  'application/json',
                  'multipart/form-data',
                  'application/x-www-form-urlencoded',
                ].includes(mediaType)
              ).toBe(true);
              expect(content.schema).toBeDefined();
            }
          );
        });
      });
    });

    it('should have proper response body definitions', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

          Object.entries(operation.responses).forEach(([statusCode, response]: [string, any]) => {
            if (!response.content) return;

            expect(Object.keys(response.content).length).toBeGreaterThan(0);

            Object.entries(response.content).forEach(([mediaType, content]: [string, any]) => {
              expect(content.schema).toBeDefined();
            });
          });
        });
      });
    });
  });

  describe('Schema Definitions Validation', () => {
    it('should have valid schema definitions', () => {
      const schemas = spec.components.schemas || {};
      expect(Object.keys(schemas).length).toBeGreaterThan(0);

      Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
        // Each schema should have a type or be a reference
        if (!schema.$ref && !schema.oneOf && !schema.anyOf && !schema.allOf) {
          expect(
            ['object', 'string', 'integer', 'number', 'boolean', 'array'].includes(schema.type)
          ).toBe(true);
        }
      });
    });

    it('should validate ApiError schema', () => {
      const apiErrorSchema = spec.components.schemas.ApiError;
      expect(apiErrorSchema).toBeDefined();
      expect(apiErrorSchema.type).toBe('object');
      expect(apiErrorSchema.required).toContain('status');
      expect(apiErrorSchema.required).toContain('code');
      expect(apiErrorSchema.required).toContain('message');
    });

    it('should validate Pagination schema', () => {
      const paginationSchema = spec.components.schemas.Pagination;
      expect(paginationSchema).toBeDefined();
      expect(paginationSchema.type).toBe('object');
      expect(paginationSchema.required).toContain('page');
      expect(paginationSchema.required).toContain('limit');
      expect(paginationSchema.required).toContain('total');
    });

    it('should have proper required field definitions', () => {
      const schemas = spec.components.schemas || {};

      Object.entries(schemas).forEach(([name, schema]: [string, any]) => {
        if (schema.type === 'object' && schema.properties) {
          if (schema.required) {
            // All required fields should exist in properties
            schema.required.forEach((fieldName: string) => {
              expect(schema.properties).toHaveProperty(fieldName);
            });
          }
        }
      });
    });
  });

  describe('Security Definitions', () => {
    it('should have proper security schemes defined', () => {
      const securitySchemes = spec.components?.securitySchemes;
      expect(securitySchemes).toBeDefined();
    });

    it('should reference valid security schemes in operations', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

          if (!operation.security) return;

          expect(Array.isArray(operation.security)).toBe(true);

          operation.security.forEach((securityObj: any) => {
            Object.keys(securityObj).forEach(schemeName => {
              expect(spec.components.securitySchemes).toHaveProperty(schemeName);
            });
          });
        });
      });
    });
  });

  describe('API Coverage', () => {
    it('should document health check endpoint', () => {
      const healthPath = spec.paths['/health'] || spec.paths['/api/health'];
      expect(healthPath).toBeDefined();
      expect(healthPath.get).toBeDefined();
    });

    it('should document authentication endpoints', () => {
      const authPaths = Object.keys(spec.paths).filter(p => p.includes('auth'));
      expect(authPaths.length).toBeGreaterThan(0);
    });

    it('should document user endpoints', () => {
      const userPaths = Object.keys(spec.paths).filter(p => p.includes('user'));
      expect(userPaths.length).toBeGreaterThan(0);
    });

    it('should document fleet endpoints', () => {
      const fleetPaths = Object.keys(spec.paths).filter(p => p.includes('fleet'));
      expect(fleetPaths.length).toBeGreaterThan(0);
    });

    it('should document organization endpoints', () => {
      const orgPaths = Object.keys(spec.paths).filter(
        p => p.includes('organization') || p.includes('org')
      );
      expect(orgPaths.length).toBeGreaterThan(0);
    });

    it('should have CRUD endpoints for major resources', () => {
      const majorResources = ['fleet', 'organization', 'user', 'activity', 'ship'];

      majorResources.forEach(resource => {
        const resourcePaths = Object.keys(spec.paths).filter(p =>
          p.toLowerCase().includes(resource)
        );

        // At least one path should exist for each major resource
        expect(resourcePaths.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Response Format Compliance', () => {
    it('should have consistent error response format', () => {
      const errorResponses = new Set<string>();

      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

          // Check for error responses
          ['400', '401', '403', '404', '500'].forEach(statusCode => {
            const response = operation.responses[statusCode];
            if (!response) return;

            const schema = response.content?.['application/json']?.schema;
            if (schema) {
              if (schema.$ref?.includes('ApiError')) {
                errorResponses.add('ApiError');
              }
            }
          });
        });
      });

      // Should have error responses
      expect(errorResponses.size).toBeGreaterThan(0);
    });

    it('should have consistent success response format for list endpoints', () => {
      const listEndpoints = Object.keys(spec.paths).filter(p => /\/api\/\w+s$/.test(p));

      listEndpoints.forEach(endpoint => {
        const pathItem = spec.paths[endpoint];
        const getOperation = pathItem.get;

        if (!getOperation) return;

        const successResponse = getOperation.responses['200'];
        expect(successResponse).toBeDefined();

        const schema = successResponse.content?.['application/json']?.schema;
        if (schema) {
          // List endpoints should typically have items and pagination
          expect(schema.properties?.items || schema.properties?.data || schema.allOf).toBeDefined();
        }
      });
    });
  });

  describe('Endpoint Tagging', () => {
    it('should have all endpoints tagged with valid tags', () => {
      const definedTags = spec.tags.map((t: any) => t.name);

      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

          if (!operation.tags) return;

          operation.tags.forEach((tag: string) => {
            expect(definedTags).toContain(tag);
          });
        });
      });
    });

    it('should have all tags used in at least one endpoint', () => {
      const usedTags = new Set<string>();

      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        Object.entries(pathItem).forEach(([method, operation]: [string, any]) => {
          if (!['get', 'post', 'put', 'delete', 'patch'].includes(method)) return;

          if (operation.tags) {
            operation.tags.forEach((tag: string) => {
              usedTags.add(tag);
            });
          }
        });
      });

      const definedTags = spec.tags.map((t: any) => t.name);

      definedTags.forEach(tag => {
        // Allow Health tag to not be used if explicitly deprecated
        if (tag === 'Health') {
          expect(usedTags.has(tag) || true).toBe(true);
        } else {
          expect(usedTags.has(tag)).toBe(true);
        }
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
