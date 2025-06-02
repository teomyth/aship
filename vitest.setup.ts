import { afterEach, vi } from 'vitest';

// Provide a consistent environment for unit tests
// Note: Integration tests should use real file system and environment

// Reset all mocks after each test
afterEach(() => {
  vi.resetAllMocks();
});

// Set test environment variables
process.env.NODE_ENV = 'test';

// Prevent commands from actually executing
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn(),
  spawn: vi.fn(),
}));
