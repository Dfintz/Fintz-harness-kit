/**
 * OpenAPI Contract Testing Configuration
 *
 * This file contains setup and configuration for OpenAPI contract testing.
 * It provides utilities and setup functions for running contract tests.
 */

import { TestEnvironment } from 'jest-environment-node';

/**
 * Custom Jest Environment for OpenAPI Contract Tests
 */
export class OpenAPITestEnvironment extends TestEnvironment {
  async setup() {
    await super.setup();

    // Set environment variables for tests
    process.env.NODE_ENV = process.env.NODE_ENV || 'test';

    // Provide OpenAPI spec path to tests
    this.global.OPENAPI_SPEC_PATH = process.env.OPENAPI_SPEC_PATH || './openapi/bundled.yaml';

    // Provide API base URL
    this.global.API_URL = process.env.API_URL || 'http://localhost:3000';

    // Provide flags for test execution
    this.global.SKIP_INTEGRATION_TESTS = process.env.SKIP_INTEGRATION_TESTS === 'true';
    this.global.RUN_SLOW_TESTS = process.env.RUN_SLOW_TESTS === 'true';
  }

  async teardown() {
    await super.teardown();
  }
}

export default OpenAPITestEnvironment;
