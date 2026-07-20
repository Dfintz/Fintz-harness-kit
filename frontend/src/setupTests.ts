// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import React from 'react';

// Polyfill text encoding and streams for Node.js test environment
import { webcrypto } from 'crypto';
import { ReadableStream, TransformStream, WritableStream } from 'stream/web';
import { TextDecoder, TextEncoder } from 'util';
import { BroadcastChannel } from 'worker_threads';

(global as any).TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;
(global as any).ReadableStream = ReadableStream;
(global as any).TransformStream = TransformStream;
(global as any).WritableStream = WritableStream;
(global as any).BroadcastChannel = BroadcastChannel;

// Mock crypto.subtle for GraphQL tests
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: webcrypto.subtle,
    getRandomValues: (arr: any) => webcrypto.getRandomValues(arr),
  },
  writable: true,
  configurable: true,
});

// Mock Vite's import.meta.env for Jest
(global as any).import = {
  meta: {
    env: {
      VITE_API_URL: '',
      VITE_WS_URL: '',
      VITE_ENCRYPTION_KEY_SEED: 'test-encryption-key-seed',
      VITE_DISCORD_CLIENT_ID: '',
      VITE_DISCORD_REDIRECT_URI: '',
      DEV: false,
      PROD: true,
      MODE: 'test',
    },
  },
};

// Mock fetch for testing
global.fetch = jest.fn();
global.Headers = jest.fn() as any;
global.Request = jest.fn() as any;
global.Response = jest.fn() as any;

// Mock axios defaults to prevent errors when modules import authStore
jest.mock('axios', () => {
  const mockAxios: Record<string, unknown> = {
    create: jest.fn((): Record<string, unknown> => mockAxios),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    defaults: {
      baseURL: '',
      withCredentials: true,
      headers: { common: {} },
    },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    isAxiosError: jest.fn((error: any) => error && error.isAxiosError === true),
  };
  return mockAxios;
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {} // NOSONAR: S1186 — intentional no-op mock for test environment
  disconnect() {} // NOSONAR: S1186 — intentional no-op mock
  observe() {} // NOSONAR: S1186 — intentional no-op mock
  takeRecords() {
    return [];
  }
  unobserve() {} // NOSONAR: S1186 — intentional no-op mock
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {} // NOSONAR: S1186 — intentional no-op mock for test environment
  disconnect() {} // NOSONAR: S1186 — intentional no-op mock
  observe() {} // NOSONAR: S1186 — intentional no-op mock
  unobserve() {} // NOSONAR: S1186 — intentional no-op mock
} as any;

// Lightweight React stubs for legacy Spectrum components still referenced in tests
const MockBox = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);
const MockStack = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);
const MockTypography = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('span', null, children);
const MockButton = ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
  React.createElement('button', { type: 'button', onClick }, children);
const MockDialog = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);
const MockDialogContainer = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);
const MockWell = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);
const MockTableBox = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);

(global as any).Box = MockBox;
(global as any).Stack = MockStack;
(global as any).Typography = MockTypography;
(global as any).Button = MockButton;
(global as any).Dialog = MockDialog;
(global as any).DialogContainer = MockDialogContainer;
(global as any).Well = MockWell;
(global as any).TableBox = MockTableBox;

// Icon stubs for tests referencing legacy Spectrum icons
const StubIcon = () => null;
[
  'Add',
  'Refresh',
  'Campaign',
  'ShoppingCart',
  'UserAdd',
  'UserGroup',
  'Shield',
  'BoxIcon',
  'Briefcase',
  'Location',
  'Settings',
  'ArrowLeft',
  'SortOrderDown',
  'VoiceOver',
  'Download',
  'Clock',
  'Calendar',
].forEach(name => {
  (global as any)[name] = StubIcon;
});

// Additional component stubs for remaining legacy Spectrum components seen in tests
const stubComponent = ({ children }: { children?: React.ReactNode }) =>
  React.createElement('div', null, children);
const componentNames = [
  'TypographyField',
  'Tabs',
  'Grid',
  'Divider',
  'MenuTrigger',
  'SearchField',
  'ProgressCircle',
  'TableHeader',
  'AlertDialog',
  'Select',
  'DialogTrigger',
  'NumberField',
  'Content',
  'Search',
  'TabList',
  'Item',
  'Column',
  'Organisations',
  'Badge',
  'Menu',
  'Form',
  'Checkbox',
  'Switch',
  'StatusLight',
  'CheckmarkCircle',
  'TypographyArea',
  'Alert',
  'ButtonGroup',
  'TabPanels',
  'TableBody',
  'TabItem',
  'TooltipTrigger',
  'TagGroup',
  'Row',
  'Link',
  'Tooltip',
];
componentNames.forEach(name => {
  (global as any)[name] = stubComponent;
});

// Mock Adobe Spectrum's ThemeProvider for legacy tests
// This allows tests to pass while we migrate from Spectrum to MUI
(global as any).ThemeProvider = ({ children }: { children: React.ReactNode }) => children;
(global as any).theme = {};
