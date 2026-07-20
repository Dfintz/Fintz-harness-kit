import { PactV3 } from '@pact-foundation/pact';
import path from 'path';

/**
 * Pact setup configuration for consumer tests
 * This file provides shared configuration for all consumer contract tests
 *
 * Note: Pact v16 provides PactV3 which uses the executeTest() pattern that
 * automatically handles setup, verification, and cleanup of the mock server.
 */

const basePactConfig = {
  consumer: 'FleetManagerFrontend',
  provider: 'FleetManagerBackend',
  logLevel: 'info' as const,
  dir: path.resolve(process.cwd(), '..', 'pacts'),
  log: path.resolve(process.cwd(), '..', 'pacts', 'logs', 'pact.log'),
};

/**
 * Create a new PactV3 instance for consumer tests
 * PactV3 uses a fluent API with methods like given(), uponReceiving(),
 * withRequest(), willRespondWith(), and executeTest()
 *
 * @param port - Optional port number for the mock server. If not provided,
 *               Pact will choose a random available port automatically.
 */
export const createPact = (port?: number): PactV3 => {
  const config = port ? { ...basePactConfig, port } : basePactConfig;
  return new PactV3(config);
};
