/**
 * Integration tests for preconnect module using Docker
 *
 * This test requires Docker to be installed and running.
 * It will create a temporary SSH server container for testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handlePreconnect, handleMultiplePreconnect } from '../../../src/preconnect/preconnect-handler';
import { connectToServer, testConnectionWithRetry } from '../../../src/preconnect/server-connect';
import { verifyUserPermissions } from '../../../src/preconnect/permission-check';
import { generateSSHKeys, cleanupSSHKeys } from '../../helpers/ssh-keys';
import { createSSHServerContainer, removeContainer, isDockerAvailable } from '../../helpers/docker';
import { PermissionLevel } from '../../../src/ssh/permissions';

// Skip these tests if SKIP_DOCKER_TESTS environment variable is set
const SKIP_DOCKER_TESTS = process.env.SKIP_DOCKER_TESTS === 'true';

// Test container configuration
let containerInfo: {
  containerName: string;
  port: number;
  username: string;
  password: string;
  sudoPassword: string;
};

// SSH key paths
let sshKeyPaths: {
  privateKeyPath: string;
  publicKeyPath: string;
  keyDir: string;
};

// Skip the entire test suite if Docker is not available or SKIP_DOCKER_TESTS is true
describe('Preconnect Integration Tests with Docker', async () => {
  // Check if Docker is available
  const dockerAvailable = await isDockerAvailable();

  if (!dockerAvailable || SKIP_DOCKER_TESTS) {
    console.log('Skipping Docker tests - Docker not available or tests explicitly skipped');
    return;
  }

  // Set up Docker container and SSH keys before all tests
  beforeAll(async () => {
    try {
      // Generate SSH keys
      sshKeyPaths = await generateSSHKeys();
      console.log(`Generated SSH keys in ${sshKeyPaths.keyDir}`);

      // Create SSH server container
      containerInfo = await createSSHServerContainer({
        publicKeyPath: sshKeyPaths.publicKeyPath,
        addToSudoers: true,
      });

      console.log(`SSH server container created: ${containerInfo.containerName}`);
      console.log(`SSH server available at localhost:${containerInfo.port}`);
      console.log(`Username: ${containerInfo.username}, Password: ${containerInfo.password}`);
    } catch (error) {
      console.error('Error setting up Docker container:', error);
      throw error;
    }
  }, 60000); // Increase timeout for Docker setup

  // Clean up Docker container and SSH keys after all tests
  afterAll(async () => {
    if (containerInfo) {
      await removeContainer(containerInfo.containerName);
    }
    if (sshKeyPaths) {
      cleanupSSHKeys(sshKeyPaths);
    }
  }, 10000); // Increase timeout for Docker cleanup

  it('should connect to SSH server with key authentication', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.serverConfig?.host).toBe('localhost');
    expect(result.serverConfig?.port).toBe(containerInfo.port);
    expect(result.serverConfig?.user).toBe(containerInfo.username);
    expect(result.serverConfig?.auth.type).toBe('key');
  }, 10000); // Increase timeout for SSH connection

  it('should connect to SSH server with password authentication', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      password: containerInfo.password,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.serverConfig?.host).toBe('localhost');
    expect(result.serverConfig?.port).toBe(containerInfo.port);
    expect(result.serverConfig?.user).toBe(containerInfo.username);
    expect(result.serverConfig?.auth.type).toBe('password');
  }, 10000); // Increase timeout for SSH connection

  it('should verify sudo permissions correctly', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
      skipPermissionCheck: false,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.permissionResult).toBeDefined();
    expect(result.permissionResult?.hasError).toBe(false);
  }, 15000); // Increase timeout for permission check

  it('should handle connection with invalid credentials', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      password: 'wrong-password',
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain('failed');
  }, 10000); // Increase timeout for SSH connection

  it('should handle connection to non-existent host', async () => {
    const result = await handlePreconnect('non-existent-host', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeDefined();
  }, 10000); // Increase timeout for SSH connection

  it('should handle connection to invalid port', async () => {
    const result = await handlePreconnect('localhost', 9999, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeDefined();
  }, 10000); // Increase timeout for SSH connection

  it('should skip connection test when specified', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
      skipConnectionTest: true,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.serverConfig?.host).toBe('localhost');
    expect(result.serverConfig?.port).toBe(containerInfo.port);
    expect(result.serverConfig?.user).toBe(containerInfo.username);
  }, 5000);

  it('should handle multiple server connections', async () => {
    const servers = [
      {
        host: 'localhost',
        port: containerInfo.port,
        username: containerInfo.username,
        privateKey: sshKeyPaths.privateKeyPath,
      },
      {
        host: 'non-existent-host',
        port: 22,
        username: 'invalid-user',
      },
    ];

    const results = await handleMultiplePreconnect(servers);

    expect(results.length).toBe(2);
    expect(results[0].success).toBe(true);
    expect(results[0].host).toBe('localhost');
    expect(results[1].success).toBe(false);
    expect(results[1].host).toBe('non-existent-host');
  }, 20000); // Increase timeout for multiple connections

  it('should test connection with retry mechanism', async () => {
    // Create a server config for testing
    const serverConfig = {
      name: 'test-server',
      host: 'localhost',
      port: containerInfo.port,
      user: containerInfo.username,
      auth: {
        type: 'key' as const,
        value: sshKeyPaths.privateKeyPath,
      },
    };

    const result = await testConnectionWithRetry(serverConfig, 3);
    expect(result).toBe(true);
  }, 15000);

  it('should verify user permissions directly', async () => {
    const result = await verifyUserPermissions(
      'localhost',
      containerInfo.port,
      containerInfo.username,
      undefined, // No password
      sshKeyPaths.privateKeyPath
    );

    expect(result.success).toBe(true);
    expect(result.authType).toBe('key');
    expect(result.authValue).toBe(sshKeyPaths.privateKeyPath);
  }, 15000);

  it('should connect to server directly', async () => {
    const result = await connectToServer(
      'localhost',
      containerInfo.port,
      containerInfo.username,
      {
        privateKey: sshKeyPaths.privateKeyPath,
      }
    );

    expect(result.success).toBe(true);
    expect(result.authType).toBe('key');
    expect(result.serverConfig).toBeDefined();
    expect(result.serverConfig?.host).toBe('localhost');
    expect(result.serverConfig?.port).toBe(containerInfo.port);
    expect(result.serverConfig?.user).toBe(containerInfo.username);
  }, 10000);
});
