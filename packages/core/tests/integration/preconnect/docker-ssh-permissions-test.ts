/**
 * Integration tests for preconnect module's permission handling using Docker
 *
 * This test requires Docker to be installed and running.
 * It will create a temporary SSH server container with a non-sudo user for testing.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { handlePreconnect } from '../../../src/preconnect/preconnect-handler';
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
describe('Preconnect Permission Handling Tests with Docker', async () => {
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

      // Create SSH server container with a non-sudo user
      containerInfo = await createSSHServerContainer({
        publicKeyPath: sshKeyPaths.publicKeyPath,
        addToSudoers: false, // This user will NOT have sudo privileges
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

  it('should detect user without sudo privileges', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
      skipPermissionCheck: false,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.permissionResult).toBeDefined();
    
    // The user should not have sudo privileges
    expect(result.permissionResult?.permissionLevel).not.toBe(PermissionLevel.ROOT);
    expect(result.permissionResult?.permissionLevel).not.toBe(PermissionLevel.SUDO);
    expect(result.permissionResult?.isInSudoGroup).toBe(false);
    expect(result.permissionResult?.hasError).toBe(true);
  }, 15000); // Increase timeout for permission check

  it('should continue with execution when exitOnPermissionFailure is false', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
      skipPermissionCheck: false,
      exitOnPermissionFailure: false,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.permissionResult).toBeDefined();
    expect(result.permissionResult?.hasError).toBe(true);
  }, 15000); // Increase timeout for permission check

  it('should skip permission check when specified', async () => {
    const result = await handlePreconnect('localhost', containerInfo.port, containerInfo.username, {
      privateKey: sshKeyPaths.privateKeyPath,
      skipPermissionCheck: true,
    });

    expect(result.success).toBe(true);
    expect(result.serverConfig).toBeDefined();
    expect(result.permissionResult).toBeUndefined();
  }, 10000); // Increase timeout for SSH connection
});
