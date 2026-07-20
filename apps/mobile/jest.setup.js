// Suppress console warnings during tests
global.console = {
  ...console,
  warn: jest.fn(),
};

// Mock expo-constants for tests
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        apiUrl: 'http://localhost:3001/api',
      },
    },
  },
  expoConfig: {
    extra: {
      apiUrl: 'http://localhost:3001/api',
    },
  },
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Mock expo-status-bar
jest.mock('expo-status-bar', () => ({
  StatusBar: 'StatusBar',
}));

