/**
 * Jest Test Setup
 *
 * This file runs once before all tests in the entire test suite.
 * It sets up global mocks and configurations that all tests need.
 */

import 'reflect-metadata';
import { mockAppDataSource } from '../helpers/database-mock';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only-not-for-production';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL = 'redis://localhost:6379/0';

// Discord configuration for tests
process.env.DISCORD_BOT_TOKEN = 'test-discord-bot-token';
process.env.DISCORD_CLIENT_ID = 'test-discord-client-id';
process.env.DISCORD_CLIENT_SECRET = 'test-discord-client-secret';
process.env.DISCORD_REDIRECT_URI = 'http://localhost:3000/api/v2/auth/discord/callback';
process.env.DISCORD_GUILD_ID = 'test-guild-id';

// Mock AppDataSource globally
jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
}));

// Mock config/database to prevent real database connections
jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  getDatabaseConfig: jest.fn().mockReturnValue({
    type: 'postgres',
    database: 'test',
  }),
}));

// Mock logger to reduce noise in tests
// Must be mocked before any imports that use logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
  log: jest.fn(),
  add: jest.fn(),
  remove: jest.fn(),
  clear: jest.fn(),
  transports: [],
};

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: mockLogger,
}));

// Suppress console output in tests (optional - comment out for debugging)
// Mock DiscordService to prevent constructor validation errors
jest.mock('../../services/discord/DiscordService', () => ({
  DiscordService: jest.fn().mockImplementation(() => ({
    login: jest.fn().mockResolvedValue(undefined),
    sendMessage: jest.fn().mockResolvedValue(undefined),
    getUserRoles: jest.fn().mockResolvedValue([]),
    getOAuthUrl: jest.fn().mockReturnValue('https://discord.com/oauth2/authorize'),
    exchangeCodeForToken: jest.fn().mockResolvedValue({
      access_token: 'mock_access_token',
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: 'mock_refresh_token',
      scope: 'identify email guilds',
    }),
    getUserInfo: jest.fn().mockResolvedValue({
      id: 'mock_user_id',
      username: 'MockUser',
      discriminator: '1234',
      avatar: null,
      email: 'mock@example.com',
      verified: true,
    }),
  })),
}));

// Mock console to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Set up default test timeout
jest.setTimeout(5000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
