// Setup file that runs before any modules are loaded
// This mocks the Expo winter runtime to prevent "import outside test scope" errors

// Mock the winter runtime modules before they're required
jest.mock('expo/src/winter/runtime.native.ts', () => ({}), { virtual: true });
jest.mock(
  'expo/src/winter/installGlobal.ts',
  () => ({
    getValue: () => undefined,
  }),
  { virtual: true }
);

// Polyfill structuredClone for testing environment
// Note: This is a simplified implementation that uses JSON serialization.
// It has limitations:
// - Does not handle functions, undefined values, or symbols
// - Does not preserve object prototypes
// - Does not handle circular references
// For production code, consider using a more robust polyfill like core-js/actual/structured-clone
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (obj) => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Mock __ExpoImportMetaRegistry
if (!global.__ExpoImportMetaRegistry) {
  global.__ExpoImportMetaRegistry = new Map();
}
