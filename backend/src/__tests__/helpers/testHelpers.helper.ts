import { Request, Response } from 'express';

import { AuthRequest } from '../../middleware/auth';

/**
 * Mock Request Factory
 * Creates mock Express Request objects for testing
 */
export class MockRequest {
  public static create(overrides: Partial<Request> = {}): Request {
    const defaultRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
      cookies: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    };
    return defaultRequest as Request;
  }

  public static createAuth(overrides: Partial<AuthRequest> = {}): AuthRequest {
    const defaultRequest = this.create(overrides);
    return {
      ...defaultRequest,
      user: overrides.user || {
        id: 'test-user-id',
        username: 'testuser',
        role: 'user',
      },
    } as AuthRequest;
  }

  public static createAdmin(overrides: Partial<AuthRequest> = {}): AuthRequest {
    return this.createAuth({
      ...overrides,
      user: {
        id: 'admin-user-id',
        username: 'admin',
        role: 'admin',
        ...(overrides.user || {}),
      },
    });
  }
}

/**
 * Mock Response Factory
 * Creates mock Express Response objects for testing
 */
export class MockResponse {
  public statusCode: number = 200;
  public data: any = null;
  public headers: Record<string, string> = {};
  public cookies: Record<string, { value: any; options: any }> = {};
  public status: jest.Mock;
  public json: jest.Mock;
  public send: jest.Mock;
  public setHeader: jest.Mock;
  public cookie: jest.Mock;
  public clearCookie: jest.Mock;
  public success: jest.Mock;
  public paginated: jest.Mock;

  constructor() {
    this.status = jest.fn().mockImplementation((code: number) => {
      this.statusCode = code;
      return this;
    });

    this.json = jest.fn().mockImplementation((data: any) => {
      this.data = data;
      return this;
    });

    this.send = jest.fn().mockImplementation((data: any) => {
      this.data = data;
      return this;
    });

    this.setHeader = jest.fn().mockImplementation((name: string, value: string) => {
      this.headers[name] = value;
      return this;
    });

    this.cookie = jest.fn().mockImplementation((name: string, value: any, options?: any) => {
      this.cookies[name] = { value, options };
      return this;
    });

    this.clearCookie = jest.fn().mockImplementation((name: string, _options?: any) => {
      delete this.cookies[name];
      return this;
    });

    // Custom response methods used by V2 controllers
    this.success = jest.fn().mockImplementation((data: any, meta?: any) => {
      this.data = { success: true, data, meta };
      return this;
    });

    this.paginated = jest.fn().mockImplementation((data: any, pagination: any, links?: any) => {
      this.data = { success: true, data, pagination, links };
      return this;
    });
  }

  public static create(): Response {
    const mockResponse = new MockResponse();
    return mockResponse as unknown as Response;
  }
}

/**
 * TestDatabase
 * Helper class for creating test database entities
 */
export class TestDatabase {
  /**
   * Create a test user object
   */
  public static createTestUser(overrides: any = {}) {
    return {
      id: 'test-user-id',
      username: 'testuser',
      email: 'test@example.com',
      discordId: 'discord-123',
      role: 'user',
      ...overrides,
    };
  }

  /**
   * Create a real user in the database
   */
  public static async createUser(data: Partial<any>): Promise<any> {
    const { AppDataSource } = require('../../data-source');
    const User = require('../../models/User').User;

    const userRepo = AppDataSource.getRepository(User);
    const user = userRepo.create({
      username: data.username || `test-${Date.now()}`,
      email: data.email || `test-${Date.now()}@example.com`,
      discordId: data.discordId || `discord-${Date.now()}`,
      passwordHash: data.passwordHash || 'dummy-hash',
      role: data.role || 'user',
      ...data,
    });

    return await userRepo.save(user);
  }

  /**
   * Delete a user from the database
   */
  public static async deleteUser(userId: string): Promise<void> {
    const { AppDataSource } = require('../../data-source');
    const User = require('../../models/User').User;

    const userRepo = AppDataSource.getRepository(User);
    await userRepo.delete(userId);
  }

  /**
   * Create a test organization object
   */
  public static createTestOrganization(overrides: any = {}) {
    return {
      id: 'test-org-id',
      name: 'Test Organization',
      spectrumId: 'TESTORG',
      description: 'Test organization description',
      ...overrides,
    };
  }

  /**
   * Create a test consent object
   */
  public static createTestConsent(overrides: any = {}) {
    return {
      id: 'test-consent-id',
      userId: 'test-user-id',
      consentType: 'data_processing',
      granted: true,
      version: '1.0',
      ipAddress: '192.168.1.1',
      createdAt: new Date(),
      ...overrides,
    };
  }
}

/**
 * Async Test Helpers
 * Utilities for async testing
 */
export class AsyncTestHelpers {
  /**
   * Wait for a promise to resolve or reject
   */
  public static async expectAsync(
    promise: Promise<any>,
    shouldReject: boolean = false
  ): Promise<any> {
    try {
      const result = await promise;
      if (shouldReject) {
        throw new Error('Expected promise to reject but it resolved');
      }
      return result;
    } catch (error) {
      if (!shouldReject) {
        throw error;
      }
      return error;
    }
  }

  /**
   * Wait for a condition to be true
   */
  public static async waitFor(
    condition: () => boolean,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for condition');
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}

/**
 * Service Mock Factory
 * Creates mock services for testing
 */
export class MockServiceFactory {
  public static createUserService() {
    return {
      getUserById: jest.fn(),
      getUserByUsername: jest.fn(),
      createUser: jest.fn(),
      updateUser: jest.fn(),
      deleteUser: jest.fn(),
      validateCredentials: jest.fn(),
      getAllUsers: jest.fn(),
    };
  }

  public static createOrganizationService() {
    return {
      getOrganizationById: jest.fn(),
      addOrganization: jest.fn(),
      updateOrganization: jest.fn(),
      deleteOrganization: jest.fn(),
      getAllOrganizations: jest.fn(),
    };
  }

  public static createConsentService() {
    return {
      recordConsent: jest.fn(),
      getUserConsents: jest.fn(),
      hasConsent: jest.fn(),
      revokeAllConsents: jest.fn(),
      exportUserData: jest.fn(),
      deleteUserData: jest.fn(),
      getConsentStatistics: jest.fn(),
    };
  }

  public static createAccountSecurityService() {
    return {
      isAccountLocked: jest.fn(),
      recordFailedAttempt: jest.fn(),
      resetFailedAttempts: jest.fn(),
      getLockoutStatus: jest.fn(),
      unlockAccount: jest.fn(),
      generateRecoveryCodes: jest.fn(),
      initiateEmailRecovery: jest.fn(),
      verifyRecoveryToken: jest.fn(),
      disable2FAWithRecovery: jest.fn(),
      logSecurityEvent: jest.fn(),
      getSecurityStats: jest.fn(),
    };
  }
}

/**
 * Assertion Helpers
 * Common assertions for testing
 */
export class AssertionHelpers {
  /**
   * Assert response status and body
   */
  public static assertResponse(
    mockResponse: any,
    expectedStatus: number,
    expectedBody?: any
  ): void {
    expect(mockResponse.statusCode).toBe(expectedStatus);
    if (expectedBody) {
      expect(mockResponse.data).toMatchObject(expectedBody);
    }
  }

  /**
   * Assert error response (v2 envelope format)
   */
  public static assertErrorResponse(
    mockResponse: any,
    expectedStatus: number,
    expectedMessage?: string
  ): void {
    expect(mockResponse.statusCode).toBe(expectedStatus);
    expect(mockResponse.data).toHaveProperty('success', false);
    expect(mockResponse.data.error).toHaveProperty('message');
    if (expectedMessage) {
      expect(mockResponse.data.error.message).toContain(expectedMessage);
    }
  }

  /**
   * Assert success response
   */
  public static assertSuccessResponse(mockResponse: any, expectedData?: any): void {
    expect(mockResponse.statusCode).toBe(200);
    expect(mockResponse.data).toBeDefined();
    if (expectedData) {
      expect(mockResponse.data).toMatchObject(expectedData);
    }
  }

  /**
   * Assert service method called
   */
  public static assertServiceCalled(
    serviceMock: jest.Mock,
    times: number = 1,
    withArgs?: any[]
  ): void {
    expect(serviceMock).toHaveBeenCalledTimes(times);
    if (withArgs) {
      expect(serviceMock).toHaveBeenCalledWith(...withArgs);
    }
  }
}
