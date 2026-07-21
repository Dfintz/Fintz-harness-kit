/* eslint-disable import/no-default-export */
/**
 * Jest manual mock for logger module
 * Jest automatically uses files in __mocks__ directories - requires default export
 */

// Create mock functions without using jest.fn() directly
const createMock = () => jest.fn();

export const mockLogger = {
  info: createMock(),
  warn: createMock(),
  error: createMock(),
  debug: createMock(),
  silly: createMock(),
  log: createMock(),
  trace: createMock(),
};

// Named export matching how services import: import { logger } from '../../utils/logger'
export const logger = mockLogger;

export default mockLogger;
