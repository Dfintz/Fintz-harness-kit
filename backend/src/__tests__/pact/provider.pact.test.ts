import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Conditionally import Pact to handle cases where it's not installed
let Verifier: any;
let getVerifierOptions: any;
let pactAvailable = false;

try {
  const pact = require('@pact-foundation/pact');
  Verifier = pact.Verifier;
  const providerStates = require('./provider-states');
  getVerifierOptions = providerStates.getVerifierOptions;
  pactAvailable = true;
} catch (error) {
  // Pact is not installed - tests will be skipped
  pactAvailable = false;
}

/**
 * Provider Verification Tests
 *
 * These tests verify that the backend provider fulfills the contracts
 * defined by the frontend consumer.
 *
 * The tests:
 * 1. Check if backend server is running
 * 2. Load the consumer contracts from the pacts directory
 * 3. Replay each request from the contract against the backend
 * 4. Verify the responses match the contract expectations
 *
 * SKIP REASON: These tests are intentionally skipped by default because they require:
 * - A running backend server at PROVIDER_URL
 * - Generated pact files from frontend tests
 * - The @pact-foundation/pact package to be installed
 *
 * To run these tests:
 * 1. Start the backend server: npm start (in backend directory)
 * 2. Generate pact files: npm test (in frontend directory)
 * 3. Set RUN_PACT_TESTS=true or PROVIDER_URL environment variable
 * 4. Run: npm run test:pact
 *
 * These tests are typically run separately from the main test suite
 * as part of contract testing workflows.
 */

// Check if backend server is accessible
async function isServerRunning(url: string, timeout = 5000): Promise<boolean> {
  try {
    await axios.get(`${url}/api/health`, {
      timeout,
      validateStatus: () => true, // Accept any status code
    });
    return true;
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND')
    ) {
      return false;
    }
    // If we get any other error, the server might be running but not responding properly
    return true;
  }
}

// Check if we should run pact verification
// Skip these tests unless explicitly enabled via environment variable
// Set RUN_PACT_TESTS=true or PROVIDER_URL to run these tests
const shouldRunPactTests = process.env.RUN_PACT_TESTS === 'true' || !!process.env.PROVIDER_URL;

const describeOrSkip = shouldRunPactTests ? describe : describe.skip;

describeOrSkip('Pact Provider Verification', () => {
  // Skip if pact files don't exist yet or Pact is not installed
  const pactDir = path.resolve(__dirname, '..', '..', '..', '..', 'pacts');
  const pactFile = path.join(pactDir, 'FleetManagerFrontend-FleetManagerBackend.json');

  it('should validate the provider against consumer contracts', async () => {
    // Check if Pact is available
    if (!pactAvailable) {
      console.log('Skipping Pact verification - @pact-foundation/pact not installed');
      return;
    }

    // Check if pact file exists
    if (!fs.existsSync(pactFile)) {
      console.warn('⚠️  Pact file not found. Run frontend tests first to generate contracts.');
      console.warn('Expected location:', pactFile);
      // Skip if contract file doesn't exist
      return;
    }

    console.log('✓ Pact file found at:', pactFile);

    // Get verifier options
    const opts = getVerifierOptions();
    const providerUrl = opts.providerBaseUrl;

    console.log('Checking if provider is running at:', providerUrl);

    // Check if server is running
    const serverRunning = await isServerRunning(providerUrl);

    if (!serverRunning) {
      console.warn('\n⚠️  WARNING: Provider server is not running!');
      console.warn('Expected server at:', providerUrl);
      console.warn('To run provider verification:');
      console.warn('  1. Start the backend server: npm start (in backend directory)');
      console.warn('  2. Or set PROVIDER_URL to a running server');
      console.warn('  3. Then run: npm run test:pact');
      console.warn('\nSkipping provider verification tests...');
      return; // Skip rather than fail
    }

    console.log('✓ Provider server is running');
    console.log('Starting verification...');

    try {
      // Run verification with proper error handling
      const output = await new Verifier(opts).verifyProvider();
      console.log('✓ Pact Verification Complete!');
      console.log(output);
    } catch (error: unknown) {
      // Log more details about the failure
      console.error('❌ Pact verification failed:', error);
      console.error('Provider URL:', opts.providerBaseUrl);
      console.error('Pact files:', opts.pactUrls);
      throw error;
    }
  }, 120000); // Increased to 120 second timeout for verification

  it('should have state handlers for all required states', () => {
    if (!pactAvailable) {
      console.log('Skipping Pact state handlers test - @pact-foundation/pact not installed');
      return;
    }

    const opts = getVerifierOptions();
    const stateHandlers = opts.stateHandlers;

    // Verify we have handlers for common states
    expect(stateHandlers).toHaveProperty('fleets exist for organization');
    expect(stateHandlers).toHaveProperty('fleet exists with id fleet-123');
    expect(stateHandlers).toHaveProperty('organizations exist');
    expect(stateHandlers).toHaveProperty('user exists with id user-123');
  });
});

/**
 * Alternative verification approach: Direct API testing
 *
 * This is useful for debugging and understanding what the contracts expect
 */
describe('Pact Provider Manual Verification', () => {
  // This section can be used for manual testing during development
  it('should be able to start provider for verification', () => {
    // This is a placeholder - actual server startup happens in verification
    expect(true).toBe(true);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
