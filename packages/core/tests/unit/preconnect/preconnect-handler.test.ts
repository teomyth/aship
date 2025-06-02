/**
 * Unit tests for the preconnect handler module
 *
 * Note: These tests focus only on the logic of the module.
 * Actual SSH connections are tested in integration tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handlePreconnect, handleMultiplePreconnect } from '../../../src/preconnect/preconnect-handler';
import { connectToServer } from '../../../src/preconnect/server-connect';
import { verifyUserPermissions } from '../../../src/preconnect/permission-check';

// Mock dependencies
vi.mock('../../../src/preconnect/server-connect', () => ({
  connectToServer: vi.fn(),
}));

vi.mock('../../../src/preconnect/permission-check', () => ({
  verifyUserPermissions: vi.fn(),
}));

// Mock chalk to avoid color output in tests
vi.mock('chalk', () => ({
  default: {
    blue: (text: string) => text,
    green: (text: string) => text,
    red: (text: string) => text,
    yellow: (text: string) => text,
    cyan: (text: string) => text,
  },
}));

// Mock console.log to avoid cluttering test output
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('Preconnect Handler Module', () => {
  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // Clear mocks after each test
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handlePreconnect', () => {
    it('should skip connection test when skipConnectionTest is true', async () => {
      const result = await handlePreconnect('example.com', 22, 'testuser', {
        skipConnectionTest: true,
      });

      expect(result.success).toBe(true);
      expect(result.serverConfig).toBeDefined();
      expect(connectToServer).not.toHaveBeenCalled();
    });

    it('should handle connection failure', async () => {
      // Mock failed connection
      (connectToServer as any).mockResolvedValue({
        success: false,
      });

      const result = await handlePreconnect('example.com', 22, 'testuser', {
        privateKey: '~/.ssh/id_rsa',
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBeDefined();
      expect(connectToServer).toHaveBeenCalledTimes(1);
      expect(verifyUserPermissions).not.toHaveBeenCalled();
    });
  });

  describe('handleMultiplePreconnect', () => {
    it('should be defined', () => {
      expect(handleMultiplePreconnect).toBeDefined();
    });
  });
});
