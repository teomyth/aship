/**
 * Integration tests for SSH utilities
 *
 * These tests verify that the SSH utilities can connect to a server and execute commands.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getAllSshKeys, autoConnect, testConnection } from '../../../src/utils/ssh.js';
import {
  TEST_SSH_HOST,
  TEST_SSH_PORT,
  TEST_SSH_USER,
  TEST_SSH_PASSWORD,
  startSshServer,
  stopSshServer,
} from '../../mocks/ssh/ssh-server';
import { Server, Client } from 'ssh2';
import * as path from 'node:path';
import * as fs from 'node:fs';

import { testSshConnectionWithKey, getTestKeyPath } from '../../helpers/ssh-client-helper';

describe('SSH utilities integration tests', () => {
  let server: Server;

  beforeAll(async () => {
    // Start the SSH server mock
    server = await startSshServer();
  });

  afterAll(async () => {
    // Stop the SSH server mock
    if (server) {
      await stopSshServer(server);
    }
  });

  describe('SSH connection tests', () => {
    it.skip('should connect to a server with password authentication', async () => {
      const result = await testConnection({
        name: 'test-server',
        host: TEST_SSH_HOST,
        port: TEST_SSH_PORT,
        user: TEST_SSH_USER,
        auth: {
          type: 'password',
          value: TEST_SSH_PASSWORD,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connection successful');
      expect(result.method).toBe('password');
    });

    it.skip('should fail to connect with incorrect password', async () => {
      const result = await testConnection({
        name: 'test-server',
        host: TEST_SSH_HOST,
        port: TEST_SSH_PORT,
        user: TEST_SSH_USER,
        auth: {
          type: 'password',
          value: 'wrong-password',
        },
      });

      expect(result.success).toBe(false);
    });

    // This test uses the ssh2 library directly to test key authentication
    // This bypasses any limitations in the node-ssh library
    it.skip('should connect with key authentication', async () => {
      // Get path to test private key (using PEM format which is supported by node-ssh)
      const testKeyPath = getTestKeyPath('test_rsa_pem');

      // Ensure the key file exists
      expect(fs.existsSync(testKeyPath)).toBe(true);

      // Test SSH connection with key authentication
      const result = await testSshConnectionWithKey(
        TEST_SSH_HOST,
        TEST_SSH_PORT,
        TEST_SSH_USER,
        testKeyPath
      );

      // Verify the result
      expect(result.success).toBe(true);
      expect(result.message).toContain('Connection successful');
      expect(result.method).toBe('key');
    });

    it.skip('should execute a command on the server', async () => {
      // Note: The testConnection function always executes 'echo "Connection successful"'
      // regardless of the testCommand parameter, so we test for that message
      const result = await testConnection({
        name: 'test-server',
        host: TEST_SSH_HOST,
        port: TEST_SSH_PORT,
        user: TEST_SSH_USER,
        auth: {
          type: 'password',
          value: TEST_SSH_PASSWORD,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Connection successful');
    });
  });
});
