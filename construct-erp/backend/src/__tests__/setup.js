process.env.JWT_SECRET = 'test-secret-for-jest-do-not-use-in-prod';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';

// Suppress winston file-transport errors during tests
jest.mock('../utils/logger', () => ({
  info:  jest.fn(),
  warn:  jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// Suppress morgan console output during tests
jest.mock('morgan', () => () => (req, res, next) => next());
