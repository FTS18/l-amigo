import '@testing-library/jest-dom';

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys) => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
      clear: jest.fn(() => Promise.resolve()),
    },
    session: {
      get: jest.fn((keys) => Promise.resolve({})),
      set: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
    },
  },
  runtime: {
    sendMessage: jest.fn(() => Promise.resolve({})),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
    getURL: jest.fn((path) => `chrome-extension://test/${path}`),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
  },
  notifications: {
    create: jest.fn(() => Promise.resolve('notification-id')),
  },
} as any;

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
