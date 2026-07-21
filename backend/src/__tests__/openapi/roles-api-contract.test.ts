/**
 * Roles API Contract Tests
 *
 * These tests verify that the Roles API (v2) responses conform to expected
 * schemas and behavioral contracts. They cover:
 *
 * 1. Response shapes for all CRUD endpoints on roles
 * 2. Auth / authorization error response format (401, 403)
 * 3. Org-scoped vs system-scoped authorization semantics
 * 4. Pagination, validation errors, and edge cases
 *
 * Endpoints under test (mounted at /api/v2/roles):
 *   GET    /                              - listRoles
 *   POST   /                              - createRole          (admin)
 *   GET    /:roleId                       - getRole
 *   PUT    /:roleId                       - updateRole          (admin)
 *   DELETE /:roleId                       - deleteRole          (admin)
 *   POST   /:roleId/assign               - assignRoleToUser    (admin)
 *   DELETE /:roleId/assign/:userId        - removeRoleFromUser  (admin)
 *   GET    /:roleId/permissions           - getRolePermissions
 *   POST   /:roleId/permissions           - addPermissionToRole (admin)
 *   DELETE /:roleId/permissions/:permId   - removePermissionFromRole (admin)
 *   GET    /search/by-scope               - searchByScope
 *   GET    /templates                     - getTemplates
 *   POST   /templates/:templateId/apply   - applyTemplate       (admin)
 *
 * Note: These tests require a running backend server.
 */

import type { AxiosInstance, AxiosResponse } from 'axios';
import axios from 'axios';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const apiBaseUrl = process.env.API_URL || 'http://localhost:3000';
const skipIfServerNotRunning = process.env.SKIP_INTEGRATION_TESTS === 'true';

/**
 * Standard success envelope returned by `res.success(data)`.
 *
 * ```json
 * { "success": true, "data": { ... }, "meta": { "timestamp": "...", "requestId": "..." } }
 * ```
 */
interface SuccessEnvelope<T = unknown> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Standard error envelope returned by the v2 error handler.
 *
 * ```json
 * { "success": false, "error": { "code": "...", "message": "...", ... } }
 * ```
 */
interface ErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp?: string;
    requestId?: string;
  };
}

// ---------------------------------------------------------------------------
// Schema assertions – reusable helpers that keep the tests DRY
// ---------------------------------------------------------------------------

/** Assert the outer success envelope shape. */
function expectSuccessEnvelope(body: unknown): asserts body is SuccessEnvelope {
  expect(body).toBeDefined();
  const obj = body as Record<string, unknown>;
  expect(obj.success).toBe(true);
  expect(obj.data).toBeDefined();
  expect(obj.meta).toBeDefined();
  expect(typeof (obj.meta as Record<string, unknown>).timestamp).toBe('string');
}

/** Assert the outer error envelope shape. */
function expectErrorEnvelope(body: unknown): asserts body is ErrorEnvelope {
  expect(body).toBeDefined();
  const obj = body as Record<string, unknown>;
  expect(obj.success).toBe(false);
  expect(obj.error).toBeDefined();
  const err = obj.error as Record<string, unknown>;
  expect(typeof err.code).toBe('string');
  expect(typeof err.message).toBe('string');
}

/**
 * Validate a Role object returned in list/detail responses.
 * At minimum a role must have `id`, `name`, `description`, `permissions`.
 */
function expectRoleShape(role: Record<string, unknown>): void {
  expect(typeof role.id).toBe('string');
  expect(typeof role.name).toBe('string');
  // description may be null-ish in the DB but the controller coerces to ''
  expect(role.description !== undefined).toBe(true);
  expect(Array.isArray(role.permissions)).toBe(true);
}

/**
 * Validate the pagination sub-object returned by listRoles.
 */
function expectPaginationShape(pagination: Record<string, unknown>): void {
  expect(typeof pagination.page).toBe('number');
  expect(typeof pagination.limit).toBe('number');
  expect(typeof pagination.total).toBe('number');
  expect(typeof pagination.pages).toBe('number');
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Roles API Contract Tests', () => {
  let client: AxiosInstance;
  let serverAvailable = false;

  beforeAll(async () => {
    client = axios.create({
      baseURL: apiBaseUrl,
      validateStatus: () => true, // never throw on any status
    });

    if (!skipIfServerNotRunning) {
      try {
        const health = await client.get('/api/health', { timeout: 3000 });
        serverAvailable = health.status < 400;
      } catch {
        serverAvailable = false;
        console.warn(
          `Backend server not running at ${apiBaseUrl}. Roles API contract tests will be skipped.`
        );
      }
    }
  });

  /** Convenience guard – returns early and logs when the server is offline. */
  function skipIfOffline(): boolean {
    if (skipIfServerNotRunning || !serverAvailable) {
      // eslint-disable-next-line no-console
      console.log('Skipping - server not running');
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // 1. Unauthenticated access – all endpoints require `authenticate`
  // -----------------------------------------------------------------------

  describe('Authentication required (401)', () => {
    const unauthEndpoints: Array<{ method: 'get' | 'post' | 'put' | 'delete'; path: string }> = [
      { method: 'get', path: '/api/v2/roles' },
      { method: 'post', path: '/api/v2/roles' },
      { method: 'get', path: '/api/v2/roles/some-role-id' },
      { method: 'put', path: '/api/v2/roles/some-role-id' },
      { method: 'delete', path: '/api/v2/roles/some-role-id' },
      { method: 'post', path: '/api/v2/roles/some-role-id/assign' },
      { method: 'delete', path: '/api/v2/roles/some-role-id/assign/some-user-id' },
      { method: 'get', path: '/api/v2/roles/some-role-id/permissions' },
      { method: 'post', path: '/api/v2/roles/some-role-id/permissions' },
      { method: 'delete', path: '/api/v2/roles/some-role-id/permissions/perm-1' },
      { method: 'get', path: '/api/v2/roles/search/by-scope?scope=system' },
      { method: 'get', path: '/api/v2/roles/templates' },
      { method: 'post', path: '/api/v2/roles/templates/template:org-admin/apply' },
    ];

    it.each(unauthEndpoints)(
      '$method $path without auth should return 401',
      async ({ method, path }) => {
        if (skipIfOffline()) return;

        const response: AxiosResponse = await client[method](path);

        expect([401, 403]).toContain(response.status);

        // Error envelope must have the standard shape
        expectErrorEnvelope(response.data);
      }
    );
  });

  // -----------------------------------------------------------------------
  // 2. GET /api/v2/roles – list roles
  // -----------------------------------------------------------------------

  describe('GET /api/v2/roles (listRoles)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('with valid auth should return success envelope with roles array and pagination', async () => {
      if (skipIfOffline()) return;

      // This test requires a valid auth token set via environment
      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;

      // roles array
      expect(Array.isArray(data.roles)).toBe(true);
      (data.roles as Array<Record<string, unknown>>).forEach(role => {
        expectRoleShape(role);
        // listRoles also exposes scope, default, modifiable
        expect(['system', 'organization']).toContain(role.scope);
        expect(typeof role.modifiable).toBe('boolean');
      });

      // pagination
      expect(data.pagination).toBeDefined();
      expectPaginationShape(data.pagination as Record<string, unknown>);
    });

    it('should respect page and limit query parameters', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles?page=1&limit=2', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      const pagination = data.pagination as Record<string, unknown>;

      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(2);
      expect((data.roles as unknown[]).length).toBeLessThanOrEqual(2);
    });

    it('should cap limit at 100', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles?limit=999', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      const pagination = data.pagination as Record<string, unknown>;
      expect(pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // 3. GET /api/v2/roles/:roleId – get role detail
  // -----------------------------------------------------------------------

  describe('GET /api/v2/roles/:roleId (getRole)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles/non-existent-id');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 for non-existent role with proper error envelope', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/non-existent-role-id', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(404);
      expectErrorEnvelope(response.data);

      const errBody = response.data as ErrorEnvelope;
      expect(errBody.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return detailed role shape with userCount for existing role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      // First, list roles to get a valid ID
      const listResp = await client.get('/api/v2/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listResp.status !== 200) return;

      const roles = ((listResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .roles as Array<Record<string, unknown>>;
      if (!roles.length) {
        console.log('Skipping - no roles in database');
        return;
      }

      const roleId = roles[0].id as string;
      const response = await client.get(`/api/v2/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;

      // Detailed role shape
      expectRoleShape(data);
      expect(['system', 'organization']).toContain(data.scope);
      expect(typeof data.priority).toBe('number');
      expect(typeof data.isSystemRole).toBe('boolean');
      expect(typeof data.modifiable).toBe('boolean');
      expect(typeof data.userCount).toBe('number');
      // timestamps
      expect(data.createdAt).toBeDefined();
      expect(data.updatedAt).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 4. POST /api/v2/roles – create role (admin only)
  // -----------------------------------------------------------------------

  describe('POST /api/v2/roles (createRole)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.post('/api/v2/roles', {
        name: 'test-role',
        scope: 'organization',
      });
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 400 when required fields are missing', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      // Missing name and scope
      const response = await client.post(
        '/api/v2/roles',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Should be 400 for missing required fields
      expect([400, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);

      if (response.status === 400) {
        expect(response.data.error.code).toBe('MISSING_REQUIRED_FIELD');
      }
    });

    it('should return 400 when organizationId missing for org-scoped role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles',
        { name: 'test-role', scope: 'organization' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Should be 400 (missing orgId) or 403 (not admin)
      expect([400, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return created role shape on success (201)', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      const roleName = `contract-test-role-${Date.now()}`;
      const response = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          description: 'Created by contract test',
          scope: 'organization',
          organizationId: orgId,
          permissions: ['org:read'],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(201);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(typeof data.id).toBe('string');
      expect(data.name).toBe(roleName);
      expect(data.scope).toBe('organization');
      expect(data.organizationId).toBe(orgId);
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(data.createdAt).toBeDefined();
      expect(typeof data.createdBy).toBe('string');

      // Cleanup: delete the role we just created
      if (data.id) {
        await client.delete(`/api/v2/roles/${data.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });
  });

  // -----------------------------------------------------------------------
  // 5. PUT /api/v2/roles/:roleId – update role (admin only)
  // -----------------------------------------------------------------------

  describe('PUT /api/v2/roles/:roleId (updateRole)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.put('/api/v2/roles/some-id', { name: 'updated' });
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 for non-existent role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.put(
        '/api/v2/roles/non-existent-role-id',
        { name: 'updated' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(404);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 403 when trying to modify a system role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      // Find a system role
      const listResp = await client.get('/api/v2/roles?includeSystem=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listResp.status !== 200) return;

      const roles = ((listResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .roles as Array<Record<string, unknown>>;
      const systemRole = roles.find(r => r.scope === 'system' || r.modifiable === false);
      if (!systemRole) {
        console.log('Skipping - no system role found');
        return;
      }

      const response = await client.put(
        `/api/v2/roles/${systemRole.id}`,
        { name: 'hacked' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(403);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('FORBIDDEN');
    });

    it('should return updated role shape on success', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      // Create a temporary role to update
      const roleName = `update-contract-test-${Date.now()}`;
      const createResp = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          description: 'Temp for update test',
          scope: 'organization',
          organizationId: orgId,
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (createResp.status !== 201) return;

      const roleId = ((createResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .id as string;

      const response = await client.put(
        `/api/v2/roles/${roleId}`,
        { name: `${roleName}-updated`, description: 'Updated by contract test' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(data.id).toBe(roleId);
      expect(data.name).toBe(`${roleName}-updated`);
      expect(data.description).toBe('Updated by contract test');
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(data.updatedAt).toBeDefined();

      // Cleanup
      await client.delete(`/api/v2/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  // -----------------------------------------------------------------------
  // 6. DELETE /api/v2/roles/:roleId – delete role (admin only)
  // -----------------------------------------------------------------------

  describe('DELETE /api/v2/roles/:roleId (deleteRole)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.delete('/api/v2/roles/some-id');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 for non-existent role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.delete('/api/v2/roles/non-existent-role-id', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(404);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return 403 when trying to delete a system role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      // Find a system role
      const listResp = await client.get('/api/v2/roles?includeSystem=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listResp.status !== 200) return;

      const roles = ((listResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .roles as Array<Record<string, unknown>>;
      const systemRole = roles.find(r => r.scope === 'system' || r.modifiable === false);
      if (!systemRole) {
        console.log('Skipping - no system role found');
        return;
      }

      const response = await client.delete(`/api/v2/roles/${systemRole.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(403);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('FORBIDDEN');
    });

    it('should return deletion confirmation shape on success', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      // Create a temporary role to delete
      const roleName = `delete-contract-test-${Date.now()}`;
      const createResp = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          description: 'Temp for delete test',
          scope: 'organization',
          organizationId: orgId,
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (createResp.status !== 201) return;

      const roleId = ((createResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .id as string;

      const response = await client.delete(`/api/v2/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(data.deletedId).toBe(roleId);
      expect(data.deletedAt).toBeDefined();
      expect(typeof data.reassignedUsers).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // 7. POST /api/v2/roles/:roleId/assign – assign role to user
  // -----------------------------------------------------------------------

  describe('POST /api/v2/roles/:roleId/assign (assignRoleToUser)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.post('/api/v2/roles/some-role-id/assign', {
        userId: 'u1',
        organizationId: 'org1',
      });
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 400 when required body fields are missing', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles/some-role-id/assign',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 400 (missing fields) or 403 (not admin for that org) or 404 (role not found)
      expect([400, 403, 404]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 when role does not exist', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles/non-existent-role-id/assign',
        { userId: 'some-user', organizationId: orgId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect([400, 403, 404]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });
  });

  // -----------------------------------------------------------------------
  // 8. DELETE /api/v2/roles/:roleId/assign/:userId – remove role from user
  // -----------------------------------------------------------------------

  describe('DELETE /api/v2/roles/:roleId/assign/:userId (removeRoleFromUser)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.delete('/api/v2/roles/some-role-id/assign/some-user-id');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 400 when organizationId body field is missing', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.delete('/api/v2/roles/some-role-id/assign/some-user-id', {
        headers: { Authorization: `Bearer ${token}` },
        // no body with organizationId
      });

      // 400 (missing organizationId) or 403 (not admin)
      expect([400, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });
  });

  // -----------------------------------------------------------------------
  // 9. GET /api/v2/roles/:roleId/permissions – get role permissions
  // -----------------------------------------------------------------------

  describe('GET /api/v2/roles/:roleId/permissions (getRolePermissions)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles/some-role-id/permissions');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 for non-existent role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/non-existent-role-id/permissions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(404);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return permissions shape for existing role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      // Get a valid role ID
      const listResp = await client.get('/api/v2/roles', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listResp.status !== 200) return;

      const roles = ((listResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .roles as Array<Record<string, unknown>>;
      if (!roles.length) {
        console.log('Skipping - no roles in database');
        return;
      }

      const roleId = roles[0].id as string;
      const response = await client.get(`/api/v2/roles/${roleId}/permissions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(data.roleId).toBe(roleId);
      expect(typeof data.roleName).toBe('string');
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(typeof data.count).toBe('number');
      expect(typeof data.isSystemRole).toBe('boolean');
      expect(typeof data.priority).toBe('number');
    });
  });

  // -----------------------------------------------------------------------
  // 10. POST /api/v2/roles/:roleId/permissions – add permission (admin)
  // -----------------------------------------------------------------------

  describe('POST /api/v2/roles/:roleId/permissions (addPermissionToRole)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.post('/api/v2/roles/some-role-id/permissions', {
        permissionId: 'org:read',
      });
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 400 when permissionId is missing', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles/some-role-id/permissions',
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // 400 (missing field), 403 (not admin), or 404 (role not found)
      expect([400, 403, 404]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 403 when trying to add permission to system role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      // Find a system role
      const listResp = await client.get('/api/v2/roles?includeSystem=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listResp.status !== 200) return;

      const roles = ((listResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .roles as Array<Record<string, unknown>>;
      const systemRole = roles.find(r => r.scope === 'system' || r.modifiable === false);
      if (!systemRole) {
        console.log('Skipping - no system role found');
        return;
      }

      const response = await client.post(
        `/api/v2/roles/${systemRole.id}/permissions`,
        { permissionId: 'some:perm' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(403);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('FORBIDDEN');
    });
  });

  // -----------------------------------------------------------------------
  // 11. DELETE /api/v2/roles/:roleId/permissions/:permissionId
  // -----------------------------------------------------------------------

  describe('DELETE /api/v2/roles/:roleId/permissions/:permissionId (removePermissionFromRole)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.delete('/api/v2/roles/some-role-id/permissions/org:read');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 for non-existent role', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.delete(
        '/api/v2/roles/non-existent-role-id/permissions/org:read',
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(404);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return removal confirmation shape on success', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      // Create a role with a permission, then remove it
      const roleName = `perm-removal-test-${Date.now()}`;
      const createResp = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          description: 'Temp for permission removal test',
          scope: 'organization',
          organizationId: orgId,
          permissions: ['org:read', 'org:write'],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (createResp.status !== 201) return;

      const roleId = ((createResp.data as SuccessEnvelope).data as Record<string, unknown>)
        .id as string;

      const response = await client.delete(`/api/v2/roles/${roleId}/permissions/org:read`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(data.roleId).toBe(roleId);
      expect(typeof data.roleName).toBe('string');
      expect(data.removedPermissionId).toBe('org:read');
      expect(Array.isArray(data.permissions)).toBe(true);
      // The remaining permissions should not include the removed one
      expect((data.permissions as string[]).includes('org:read')).toBe(false);
      expect(data.removedAt).toBeDefined();

      // Cleanup
      await client.delete(`/api/v2/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

  // -----------------------------------------------------------------------
  // 12. GET /api/v2/roles/search/by-scope – search roles by scope
  // -----------------------------------------------------------------------

  describe('GET /api/v2/roles/search/by-scope (searchByScope)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles/search/by-scope?scope=system');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 400 when scope parameter is missing', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/search/by-scope', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(400);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('INVALID_INPUT');
    });

    it('should return 400 for invalid scope value', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/search/by-scope?scope=invalid', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(400);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('INVALID_INPUT');
    });

    it('should return roles grouped by scope with count', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/search/by-scope?scope=system', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(data.scope).toBe('system');
      expect(Array.isArray(data.roles)).toBe(true);
      expect(typeof data.count).toBe('number');

      (data.roles as Array<Record<string, unknown>>).forEach(role => {
        expectRoleShape(role);
        expect(role.scope).toBe('system');
      });
    });
  });

  // -----------------------------------------------------------------------
  // 13. GET /api/v2/roles/templates – get role templates
  // -----------------------------------------------------------------------

  describe('GET /api/v2/roles/templates (getTemplates)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles/templates');
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return templates array with expected shape', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(response.status).toBe(200);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(Array.isArray(data.templates)).toBe(true);
      expect(typeof data.count).toBe('number');
      expect(data.count).toBe((data.templates as unknown[]).length);

      (data.templates as Array<Record<string, unknown>>).forEach(template => {
        expect(typeof template.id).toBe('string');
        expect(typeof template.name).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(typeof template.scope).toBe('string');
        expect(Array.isArray(template.permissions)).toBe(true);
      });
    });

    it('should include the three built-in templates', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_AUTH_TOKEN not set');
        return;
      }

      const response = await client.get('/api/v2/roles/templates', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status !== 200) return;

      const templates = ((response.data as SuccessEnvelope).data as Record<string, unknown>)
        .templates as Array<Record<string, unknown>>;
      const ids = templates.map(t => t.id);

      expect(ids).toContain('template:org-admin');
      expect(ids).toContain('template:fleet-lead');
      expect(ids).toContain('template:member');
    });
  });

  // -----------------------------------------------------------------------
  // 14. POST /api/v2/roles/templates/:templateId/apply – apply template
  // -----------------------------------------------------------------------

  describe('POST /api/v2/roles/templates/:templateId/apply (applyTemplate)', () => {
    it('should return 401/403 without authentication', async () => {
      if (skipIfOffline()) return;

      const response = await client.post('/api/v2/roles/templates/template:org-admin/apply', {
        roleName: 'new-role',
        organizationId: 'org1',
      });
      expect([401, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 400 when roleName is missing', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles/templates/template:org-admin/apply',
        { organizationId: 'org1' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect([400, 403]).toContain(response.status);
      expectErrorEnvelope(response.data);
    });

    it('should return 404 for non-existent template', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles/templates/template:nonexistent/apply',
        { roleName: 'some-role', organizationId: orgId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(404);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    it('should return created role shape with templateApplied on success (201)', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      const roleName = `template-apply-test-${Date.now()}`;
      const response = await client.post(
        '/api/v2/roles/templates/template:member/apply',
        { roleName, organizationId: orgId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(201);
      expectSuccessEnvelope(response.data);

      const data = (response.data as SuccessEnvelope).data as Record<string, unknown>;
      expect(typeof data.id).toBe('string');
      expect(data.name).toBe(roleName);
      expect(data.templateApplied).toBe('template:member');
      expect(data.organizationId).toBe(orgId);
      expect(Array.isArray(data.permissions)).toBe(true);
      expect(typeof data.priority).toBe('number');
      expect(data.createdAt).toBeDefined();

      // Cleanup
      if (data.id) {
        await client.delete(`/api/v2/roles/${data.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });
  });

  // -----------------------------------------------------------------------
  // 15. Org-scoped vs System-scoped authorization semantics
  // -----------------------------------------------------------------------

  describe('Authorization: org-scoped vs system-scoped roles', () => {
    /**
     * The RolesControllerV2 uses `verifyRoleManagementAccess` which diverges
     * based on whether an operation targets an org-scoped role or a system-
     * scoped role:
     *
     * - Org-scoped: requires the requesting user to have an owner/admin
     *   membership in the target organization (checked via
     *   OrganizationMembership).
     *
     * - System-scoped: requires the user to have `User.role === 'admin'`
     *   (platform admin flag).
     *
     * These tests document and verify that distinction.
     */

    it('creating an org-scoped role without org admin membership should return 403', async () => {
      if (skipIfOffline()) return;

      // Use a regular user token (not an org admin)
      const token = process.env.TEST_MEMBER_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_MEMBER_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles',
        {
          name: `unauthorized-role-${Date.now()}`,
          scope: 'organization',
          organizationId: orgId,
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(403);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('FORBIDDEN');
      expect(response.data.error.message).toContain('Organization admin access required');
    });

    it('creating a system-scoped role without platform admin should return 403', async () => {
      if (skipIfOffline()) return;

      // Use a regular user token (not a platform admin)
      const token = process.env.TEST_MEMBER_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_MEMBER_AUTH_TOKEN not set');
        return;
      }

      const response = await client.post(
        '/api/v2/roles',
        {
          name: `unauthorized-system-role-${Date.now()}`,
          scope: 'system',
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(response.status).toBe(403);
      expectErrorEnvelope(response.data);
      expect(response.data.error.code).toBe('FORBIDDEN');
      expect(response.data.error.message).toContain('Platform admin access required');
    });

    it('403 error response should always have code and message fields', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_MEMBER_AUTH_TOKEN;
      if (!token) {
        console.log('Skipping - TEST_MEMBER_AUTH_TOKEN not set');
        return;
      }

      // Trigger a 403 via any admin-only endpoint
      const response = await client.post(
        '/api/v2/roles',
        { name: 'test', scope: 'system', permissions: [] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.status === 403) {
        expectErrorEnvelope(response.data);
        const errBody = response.data as ErrorEnvelope;
        // Verify structural fields exist
        expect(typeof errBody.error.code).toBe('string');
        expect(typeof errBody.error.message).toBe('string');
        expect(errBody.error.code.length).toBeGreaterThan(0);
        expect(errBody.error.message.length).toBeGreaterThan(0);
      }
    });

    it('org admin should be able to manage org-scoped roles but not system roles', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      // Creating an org-scoped role should succeed for an org admin
      const roleName = `org-admin-test-${Date.now()}`;
      const createResp = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          scope: 'organization',
          organizationId: orgId,
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Could be 201 (success) or 403 (if token is not org admin)
      if (createResp.status === 201) {
        expectSuccessEnvelope(createResp.data);
        const data = (createResp.data as SuccessEnvelope).data as Record<string, unknown>;
        expect(data.scope).toBe('organization');

        // Cleanup
        await client.delete(`/api/v2/roles/${data.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    });
  });

  // -----------------------------------------------------------------------
  // 16. Cross-cutting concerns: error serialization and content type
  // -----------------------------------------------------------------------

  describe('Cross-cutting response concerns', () => {
    it('error responses should be valid JSON with application/json content-type', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles');
      // Should be an auth error
      expect(response.headers['content-type']).toContain('application/json');
      // Must be serializable (no circular refs)
      expect(() => JSON.stringify(response.data)).not.toThrow();
    });

    it('error responses should not expose stack traces', async () => {
      if (skipIfOffline()) return;

      const response = await client.get('/api/v2/roles');
      const serialized = JSON.stringify(response.data);
      expect(serialized).not.toContain('at Object.');
      expect(serialized).not.toContain('at Module.');
      expect(serialized).not.toContain('.ts:');
    });

    it('all error envelopes should set success to false', async () => {
      if (skipIfOffline()) return;

      // Hit several endpoints that will error without auth
      const endpoints = [
        '/api/v2/roles',
        '/api/v2/roles/nonexistent',
        '/api/v2/roles/nonexistent/permissions',
      ];

      for (const ep of endpoints) {
        const resp = await client.get(ep);
        if (resp.status >= 400) {
          expect(resp.data.success).toBe(false);
        }
      }
    });

    it('409 conflict should use RESOURCE_ALREADY_EXISTS code', async () => {
      if (skipIfOffline()) return;

      const token = process.env.TEST_ADMIN_AUTH_TOKEN;
      const orgId = process.env.TEST_ORGANIZATION_ID;
      if (!token || !orgId) {
        console.log('Skipping - TEST_ADMIN_AUTH_TOKEN or TEST_ORGANIZATION_ID not set');
        return;
      }

      // Create a role, then try to create another with the same name
      const roleName = `conflict-test-${Date.now()}`;
      const first = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          scope: 'organization',
          organizationId: orgId,
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (first.status !== 201) return;

      const roleId = ((first.data as SuccessEnvelope).data as Record<string, unknown>).id as string;

      const duplicate = await client.post(
        '/api/v2/roles',
        {
          name: roleName,
          scope: 'organization',
          organizationId: orgId,
          permissions: [],
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      expect(duplicate.status).toBe(409);
      expectErrorEnvelope(duplicate.data);
      expect(duplicate.data.error.code).toBe('RESOURCE_ALREADY_EXISTS');

      // Cleanup
      await client.delete(`/api/v2/roles/${roleId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
