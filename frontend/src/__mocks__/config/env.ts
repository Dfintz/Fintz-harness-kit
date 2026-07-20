/**
 * Mock environment configuration for Jest tests.
 * This module provides the same interface as config/env.ts but with test defaults.
 */

export const env = {
  API_URL: '/api',
  WS_URL: 'http://localhost:3000',
  IS_DEV: false,
  IS_PROD: true,
  MODE: 'test',
};

export const API_URL = env.API_URL;
export const WS_URL = env.WS_URL;
export const IS_DEV = env.IS_DEV;
export const IS_PROD = env.IS_PROD;
export const MODE = env.MODE;

/**
 * Mock getBackendUrl function for tests
 */
export function getBackendUrl(): string {
  return env.API_URL;
}

/**
 * Mock getBackendWsUrl function for tests
 */
export function getBackendWsUrl(): string {
  return env.WS_URL;
}
