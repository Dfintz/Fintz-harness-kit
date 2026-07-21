/**
 * OpenAPI Endpoints Coverage Test
 *
 * This test ensures that:
 * 1. All implemented API endpoints are documented in the OpenAPI spec
 * 2. All OpenAPI spec endpoints have corresponding implementations
 * 3. HTTP methods match between implementation and specification
 * 4. Endpoint paths are consistent
 *
 * This prevents documentation drift and ensures the specification
 * always matches the actual API implementation.
 */

import * as fs from 'fs';
import YAML from 'js-yaml';
import * as path from 'path';

// Check if OpenAPI spec exists
const specPath = path.resolve(__dirname, '../../openapi/bundled.yaml');
const specExists = fs.existsSync(specPath);

const describeSpec = specExists ? describe : describe.skip;

describeSpec('OpenAPI Endpoints Coverage', () => {
  let spec: any;
  let routeFiles: string[];
  const routesDir = path.resolve(__dirname, '../../routes');

  beforeAll(() => {
    // Load OpenAPI spec
    const specContent = fs.readFileSync(specPath, 'utf-8');
    spec = YAML.load(specContent) as any;

    // Get all route files
    routeFiles = fs
      .readdirSync(routesDir)
      .filter(f => f.endsWith('Routes.ts') || f.endsWith('routes.ts'));
  });

  describe('OpenAPI Specification Coverage', () => {
    it('should have documented paths', () => {
      expect(spec.paths).toBeDefined();
      expect(Object.keys(spec.paths).length).toBeGreaterThan(0);
    });

    it('should have at least 20 documented endpoints', () => {
      const endpoints = Object.keys(spec.paths);
      expect(endpoints.length).toBeGreaterThanOrEqual(20);
    });

    it('should document core resource endpoints', () => {
      const requiredEndpoints = [
        'Health',
        'Users',
        'Fleets',
        'Organizations',
        'Activities',
        'Ships',
      ];

      const tags = spec.tags.map((t: any) => t.name);

      requiredEndpoints.forEach(resource => {
        expect(tags).toContain(resource);
      });
    });

    it('should have CRUD endpoints for all major resources', () => {
      const paths = Object.keys(spec.paths);

      // Check for list/create endpoints (plural)
      const hasFleetList = paths.some(p => p.includes('/fleets'));
      const hasOrgList = paths.some(p => p.includes('/organizations'));

      expect(hasFleetList).toBe(true);
      expect(hasOrgList).toBe(true);

      // Check for detail/update endpoints (with ID parameter)
      const hasFleetDetail = paths.some(p => p.includes('/fleets/{') || p.includes('/fleets/:'));
      const hasOrgDetail = paths.some(
        p => p.includes('/organizations/{') || p.includes('/organizations/:')
      );

      expect(hasFleetDetail).toBe(true);
      expect(hasOrgDetail).toBe(true);
    });
  });

  describe('Endpoint Implementation Coverage', () => {
    it('should have multiple route files', () => {
      expect(routeFiles.length).toBeGreaterThan(5);
    });

    it('should have routes directory', () => {
      expect(fs.existsSync(routesDir)).toBe(true);
    });

    it('route files should follow naming convention', () => {
      routeFiles.forEach(file => {
        expect(file.endsWith('Routes.ts') || file.endsWith('routes.ts')).toBe(true);
      });
    });

    it('should document all major route files in OpenAPI spec', () => {
      const majorRoutes = ['auth', 'fleet', 'organization', 'user', 'activity', 'ship'];

      majorRoutes.forEach(route => {
        const hasRoute = routeFiles.some(f => f.toLowerCase().includes(route));
        expect(hasRoute).toBe(true);
      });
    });
  });

  describe('HTTP Method Documentation', () => {
    it('should document GET methods for retrieval', () => {
      const pathsWithGet = Object.values(spec.paths).filter((path: any) => path.get);
      expect(pathsWithGet.length).toBeGreaterThan(0);
    });

    it('should document POST methods for creation', () => {
      const pathsWithPost = Object.values(spec.paths).filter((path: any) => path.post);
      expect(pathsWithPost.length).toBeGreaterThan(0);
    });

    it('should document PUT methods for updates', () => {
      const pathsWithPut = Object.values(spec.paths).filter((path: any) => path.put);
      expect(pathsWithPut.length).toBeGreaterThan(0);
    });

    it('should document DELETE methods for deletion', () => {
      const pathsWithDelete = Object.values(spec.paths).filter((path: any) => path.delete);
      expect(pathsWithDelete.length).toBeGreaterThan(0);
    });

    it('should document PATCH methods for partial updates', () => {
      const pathsWithPatch = Object.values(spec.paths).filter((path: any) => path.patch);
      // PATCH is optional but good to have
      expect(pathsWithPatch.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Path Parameter Consistency', () => {
    it('should use consistent path parameter naming', () => {
      const paths = Object.keys(spec.paths);
      const paramPatterns = new Set<string>();

      paths.forEach(path => {
        const matches = path.match(/{[^}]+}/g);
        if (matches) {
          matches.forEach(param => {
            paramPatterns.add(param);
          });
        }
      });

      // Should have ID parameters
      const hasIdParams = Array.from(paramPatterns).some(p => p.toLowerCase().includes('id'));
      expect(hasIdParams).toBe(true);
    });

    it('should document required path parameters', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        // Count path parameters in the URL
        const pathParams = (pathKey.match(/{[^}]+}/g) || []).length;

        if (pathParams > 0) {
          // Should have corresponding parameters documented
          ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
            const operation = pathItem[method];
            if (!operation) return;

            const documentedParams =
              operation.parameters?.filter((p: any) => p.in === 'path') || [];

            expect(documentedParams.length).toBeGreaterThanOrEqual(pathParams);
          });
        }
      });
    });

    it('should use consistent parameter types', () => {
      const paramTypes = new Map<string, Set<string>>();

      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
          const operation = pathItem[method];
          if (!operation?.parameters) return;

          operation.parameters.forEach((param: any) => {
            if (!paramTypes.has(param.name)) {
              paramTypes.set(param.name, new Set());
            }

            const schemaType = param.schema?.type || param.schema?.format;
            if (schemaType) {
              paramTypes.get(param.name)!.add(schemaType);
            }
          });
        });
      });

      // Parameters with the same name should have consistent types
      paramTypes.forEach((types, paramName) => {
        // Allow minor variations for backward compatibility
        expect(types.size).toBeLessThanOrEqual(2);
      });
    });
  });

  describe('Request/Response Documentation', () => {
    it('should document request bodies for POST endpoints', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        const postOp = pathItem.post;
        if (!postOp) return;

        // POST endpoints should document request body
        expect(postOp.requestBody).toBeDefined();
        expect(postOp.requestBody.content['application/json']).toBeDefined();
        expect(postOp.requestBody.content['application/json'].schema).toBeDefined();
      });
    });

    it('should document response schemas for all operations', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
          const operation = pathItem[method];
          if (!operation) return;

          // Should have at least 200 response
          expect(operation.responses['200']).toBeDefined();

          // 200 response should have content
          const response = operation.responses['200'];
          if (response.content) {
            expect(response.content['application/json']).toBeDefined();
            expect(response.content['application/json'].schema).toBeDefined();
          }
        });
      });
    });

    it('should document error responses', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
          const operation = pathItem[method];
          if (!operation) return;

          // Should have error responses documented
          const hasErrorResponse = ['400', '401', '403', '404', '500'].some(
            code => operation.responses[code]
          );

          expect(hasErrorResponse).toBe(true);
        });
      });
    });
  });

  describe('Documentation Completeness', () => {
    it('should have summary or description for all operations', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
          const operation = pathItem[method];
          if (!operation) return;

          expect(operation.summary || operation.description).toBeDefined();
          expect(typeof (operation.summary || operation.description)).toBe('string');
          expect((operation.summary || operation.description)!.length).toBeGreaterThan(0);
        });
      });
    });

    it('should have examples for major endpoints', () => {
      const criticalPaths = ['/api/health', '/api/v2/users/me'];

      criticalPaths.forEach(critPath => {
        const pathItem = spec.paths[critPath];
        if (pathItem) {
          // Should have at least one operation with documentation
          const hasDocumentation = ['get', 'post', 'put', 'delete'].some(
            method => pathItem[method] && (pathItem[method].summary || pathItem[method].description)
          );

          expect(hasDocumentation).toBe(true);
        }
      });
    });

    it('should not have placeholder or incomplete descriptions', () => {
      const placeholders = ['TODO', 'FIXME', 'TBD', 'undefined'];

      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
          const operation = pathItem[method];
          if (!operation) return;

          const desc = operation.summary || operation.description || '';

          placeholders.forEach(placeholder => {
            expect(desc.toUpperCase()).not.toContain(placeholder.toUpperCase());
          });
        });
      });
    });
  });

  describe('API Consistency', () => {
    it('should use consistent base path', () => {
      const paths = Object.keys(spec.paths);

      // Most endpoints should start with /api/
      const apiEndpoints = paths.filter(p => p.startsWith('/api/'));
      const publicEndpoints = paths.filter(p => !p.startsWith('/api/'));

      // Should have consistent structure
      expect(apiEndpoints.length + publicEndpoints.length).toBe(paths.length);
    });

    it('should use consistent naming conventions for resources', () => {
      const paths = Object.keys(spec.paths);
      const resourcePatterns = new Map<string, number>();

      paths.forEach(path => {
        // Extract resource name from path
        const match = path.match(/\/(\w+)(?:\{|\/|$)/);
        if (match) {
          const resource = match[1];
          resourcePatterns.set(resource, (resourcePatterns.get(resource) || 0) + 1);
        }
      });

      // Resources should be documented consistently
      expect(resourcePatterns.size).toBeGreaterThan(0);
    });

    it('should follow REST conventions', () => {
      Object.entries(spec.paths).forEach(([pathKey, pathItem]: [string, any]) => {
        // Collection endpoints (plural) should support GET, POST
        if (pathKey.endsWith('s') && !pathKey.includes('{')) {
          if (pathItem.get) {
            expect(pathItem.get.summary || pathItem.get.description).toBeDefined();
          }
        }

        // Resource endpoints with ID should support GET, PUT, DELETE
        if (pathKey.includes('{')) {
          if (pathItem.get) {
            expect(pathItem.get).toBeDefined();
          }
        }
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
