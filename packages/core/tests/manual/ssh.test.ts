/**
 * Manual tests for SSH utilities
 *
 * These tests require a real SSH server to connect to.
 * They are meant to be run manually, not as part of automated testing.
 *
 * To run these tests:
 * 1. Set up an SSH server (or use an existing one)
 * 2. Update the server configurations below with real values
 * 3. Run the tests with: npx vitest run tests/manual/ssh.test.ts
 */

import { describe, expect, it } from 'vitest';
import { testConnection } from '../../src/utils/ssh.js';

describe('SSH utilities manual tests', () => {
  describe('testConnection', () => {
    it.skip('should successfully connect to a valid server with password', async () => {
      // This test requires a real SSH server with password authentication
      const server = {
        name: 'test-server',
        host: 'localhost', // Replace with a real server
        port: 22,
        user: 'test-user', // Replace with a real user
        auth: {
          type: 'password' as const,
          value: 'test-password', // Replace with a real password
        },
      };

      const result = await testConnection(server);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it.skip('should successfully connect to a valid server with SSH key', async () => {
      // This test requires a real SSH server with key authentication
      const server = {
        name: 'test-server',
        host: 'localhost', // Replace with a real server
        port: 22,
        user: 'test-user', // Replace with a real user
        auth: {
          type: 'key' as const,
          value: '/path/to/private/key', // Replace with a real key path
        },
      };

      const result = await testConnection(server);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it.skip('should fail to connect to an invalid server', async () => {
      const server = {
        name: 'invalid-server',
        host: 'non-existent-host',
        port: 22,
        user: 'invalid-user',
        auth: {
          type: 'password' as const,
          value: 'invalid-password',
        },
      };

      const result = await testConnection(server);
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy(); // Error message should be present
    });

    it.skip('should fail with invalid credentials', async () => {
      const server = {
        name: 'test-server',
        host: 'localhost', // Replace with a real server
        port: 22,
        user: 'test-user', // Replace with a real user
        auth: {
          type: 'password' as const,
          value: 'wrong-password',
        },
      };

      const result = await testConnection(server);
      expect(result.success).toBe(false);
      expect(result.message).toBeTruthy(); // Error message should be present
    });
  });
});
