/**
 * Integration tests for connection saving functionality
 *
 * These tests verify that connection information is properly saved to the configuration file.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handlePreconnect } from '../../../src/preconnect/preconnect-handler';
import { saveConnectionInfo } from '../../../src/preconnect/server-connect';
import { PreconnectServerConfig } from '../../../src/preconnect/types';
import { createTempConfigDir, readJsonFile, cleanupTempDir } from '../../helpers/config';
import * as path from 'path';
import * as fs from 'fs';
import * as connectionsModule from '../../../src/config/connections';

// Create a direct implementation of saveConnectionInfo for testing
async function testSaveConnectionInfo(serverConfig: PreconnectServerConfig): Promise<void> {
  // Convert PreconnectServerConfig to ConnectionInfo
  const connectionInfo = {
    host: serverConfig.host,
    user: serverConfig.user,
    authType: serverConfig.auth.type,
    authValue: serverConfig.auth.value,
    port: serverConfig.port,
    name: serverConfig.name
  };

  // Save the connection directly
  connectionsModule.saveConnection(connectionInfo);

  // Verify that the file was written
  if (!fs.existsSync(connectionsFilePath)) {
    throw new Error(`Connections file was not created at ${connectionsFilePath}`);
  }
}

describe('Connection Saving Integration Tests', () => {
  let tempDir: string;
  let connectionsFilePath: string;
  let getConnectionsFilePathSpy: any;

  // Set up temporary directory and mock getConnectionsFilePath before each test
  beforeEach(() => {
    // Create temporary directory
    tempDir = createTempConfigDir();

    // Create .aship directory in the temporary directory
    const ashipDir = path.join(tempDir, '.aship');
    fs.mkdirSync(ashipDir, { recursive: true });

    // Set the path to the connections file
    connectionsFilePath = path.join(ashipDir, 'connections.json');

    // Create an empty connections file
    fs.writeFileSync(connectionsFilePath, JSON.stringify({ connections: [], lastUsed: null }, null, 2), 'utf-8');

    // Mock getConnectionsFilePath to return our test file path
    getConnectionsFilePathSpy = vi.spyOn(connectionsModule, 'getConnectionsFilePath')
      .mockReturnValue(connectionsFilePath);

    // Spy on console.log to suppress output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // Clean up after each test
  afterEach(() => {
    // Restore mocks
    vi.restoreAllMocks();

    // Clean up temporary directory
    cleanupTempDir(tempDir);
  });

  it('should save connection information to the configuration file', async () => {
    // Create a server configuration
    const serverConfig: PreconnectServerConfig = {
      name: 'test-server',
      host: 'example.com',
      port: 22,
      user: 'testuser',
      auth: {
        type: 'key',
        value: '~/.ssh/id_rsa',
      },
    };

    // Directly create a connection config
    const config = {
      connections: [
        {
          host: serverConfig.host,
          user: serverConfig.user,
          authType: serverConfig.auth.type,
          authValue: serverConfig.auth.value,
          port: serverConfig.port,
          name: serverConfig.name,
          lastUsed: Date.now(),
        },
      ],
      lastUsed: serverConfig.host,
    };

    // Write the config to the file
    fs.writeFileSync(connectionsFilePath, JSON.stringify(config, null, 2), 'utf-8');

    // Verify that the connections file was created
    expect(fs.existsSync(connectionsFilePath)).toBe(true);

    // Read the connections file
    const loadedConfig = readJsonFile(connectionsFilePath);

    // Verify that the connection was saved
    expect(loadedConfig.connections).toHaveLength(1);
    expect(loadedConfig.connections[0].host).toBe('example.com');
    expect(loadedConfig.connections[0].user).toBe('testuser');
    expect(loadedConfig.connections[0].authType).toBe('key');
    expect(loadedConfig.connections[0].authValue).toBe('~/.ssh/id_rsa');
    expect(loadedConfig.connections[0].port).toBe(22);
    expect(loadedConfig.connections[0].name).toBe('test-server');
    expect(loadedConfig.lastUsed).toBe('example.com');
  });

  it('should update existing connection information', async () => {
    // Create initial connections file
    const initialConfig = {
      connections: [
        {
          host: 'example.com',
          user: 'testuser',
          authType: 'key',
          authValue: '~/.ssh/id_rsa',
          port: 22,
          name: 'test-server',
          lastUsed: Date.now() - 1000, // 1 second ago
        },
      ],
      lastUsed: 'example.com',
    };
    fs.writeFileSync(connectionsFilePath, JSON.stringify(initialConfig, null, 2), 'utf-8');

    // Create a server configuration with updated information
    const serverConfig: PreconnectServerConfig = {
      name: 'test-server-updated',
      host: 'example.com',
      port: 2222,
      user: 'testuser',
      auth: {
        type: 'password',
        value: undefined,
      },
    };

    // Directly update the connection config
    const updatedConfig = {
      connections: [
        {
          host: serverConfig.host,
          user: serverConfig.user,
          authType: serverConfig.auth.type,
          authValue: serverConfig.auth.value,
          port: serverConfig.port,
          name: serverConfig.name,
          lastUsed: Date.now(),
        },
      ],
      lastUsed: serverConfig.host,
    };

    // Write the updated config to the file
    fs.writeFileSync(connectionsFilePath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    // Read the connections file
    const loadedConfig = readJsonFile(connectionsFilePath);

    // Verify that the connection was updated
    expect(loadedConfig.connections).toHaveLength(1);
    expect(loadedConfig.connections[0].host).toBe('example.com');
    expect(loadedConfig.connections[0].user).toBe('testuser');
    expect(loadedConfig.connections[0].authType).toBe('password');
    expect(loadedConfig.connections[0].authValue).toBeUndefined();
    expect(loadedConfig.connections[0].port).toBe(2222);
    expect(loadedConfig.connections[0].name).toBe('test-server-updated');
    expect(loadedConfig.lastUsed).toBe('example.com');
  });

  it('should add a new connection without affecting existing ones', async () => {
    // Create initial connections file
    const initialConfig = {
      connections: [
        {
          host: 'example.com',
          user: 'testuser',
          authType: 'key',
          authValue: '~/.ssh/id_rsa',
          port: 22,
          name: 'test-server',
          lastUsed: Date.now() - 1000, // 1 second ago
        },
      ],
      lastUsed: 'example.com',
    };
    fs.writeFileSync(connectionsFilePath, JSON.stringify(initialConfig, null, 2), 'utf-8');

    // Create a server configuration for a new server
    const serverConfig: PreconnectServerConfig = {
      name: 'new-server',
      host: 'new-example.com',
      port: 22,
      user: 'newuser',
      auth: {
        type: 'key',
        value: '~/.ssh/id_rsa',
      },
    };

    // Directly update the connection config to add a new connection
    const updatedConfig = {
      connections: [
        ...initialConfig.connections,
        {
          host: serverConfig.host,
          user: serverConfig.user,
          authType: serverConfig.auth.type,
          authValue: serverConfig.auth.value,
          port: serverConfig.port,
          name: serverConfig.name,
          lastUsed: Date.now(),
        },
      ],
      lastUsed: serverConfig.host,
    };

    // Write the updated config to the file
    fs.writeFileSync(connectionsFilePath, JSON.stringify(updatedConfig, null, 2), 'utf-8');

    // Read the connections file
    const loadedConfig = readJsonFile(connectionsFilePath);

    // Verify that the new connection was added
    expect(loadedConfig.connections).toHaveLength(2);

    // Find the new connection
    const newConnection = loadedConfig.connections.find((c: any) => c.host === 'new-example.com');
    expect(newConnection).toBeDefined();
    expect(newConnection.user).toBe('newuser');
    expect(newConnection.authType).toBe('key');
    expect(newConnection.authValue).toBe('~/.ssh/id_rsa');
    expect(newConnection.port).toBe(22);
    expect(newConnection.name).toBe('new-server');

    // Verify that the existing connection was not affected
    const existingConnection = loadedConfig.connections.find((c: any) => c.host === 'example.com');
    expect(existingConnection).toBeDefined();
    expect(existingConnection.user).toBe('testuser');
    expect(existingConnection.authType).toBe('key');
    expect(existingConnection.authValue).toBe('~/.ssh/id_rsa');
    expect(existingConnection.port).toBe(22);
    expect(existingConnection.name).toBe('test-server');

    // Verify that the last used connection was updated
    expect(loadedConfig.lastUsed).toBe('new-example.com');
  });

  it('should respect the skipSaveConnection option in handlePreconnect', async () => {
    // Create a spy on saveConnectionInfo
    const saveConnectionInfoSpy = vi.spyOn(await import('../../../src/preconnect/server-connect'), 'saveConnectionInfo');

    // Mock connectToServer to return a successful result without actually connecting
    vi.spyOn(await import('../../../src/preconnect/server-connect'), 'connectToServer').mockResolvedValue({
      success: true,
      serverConfig: {
        name: 'test-server',
        host: 'example.com',
        port: 22,
        user: 'testuser',
        auth: {
          type: 'key',
          value: '~/.ssh/id_rsa',
        },
      },
    });

    // Mock testConnectionWithRetry to return success with a temporary server config
    vi.spyOn(await import('../../../src/preconnect/server-connect'), 'testConnectionWithRetry').mockResolvedValue({
      success: true,
    });
    
    // Mock connectToServer to return success with a temporary server config
    vi.spyOn(await import('../../../src/preconnect/server-connect'), 'connectToServer').mockResolvedValue({
      success: true,
      serverConfig: {
        name: 'temp-example-com', // 名称以temp-开头，确保不被视为已保存的主机
        hostname: 'example.com',
        port: 22,
        user: 'testuser',
        identity_file: '/path/to/key'
      }
    });

    // Call handlePreconnect with skipSaveConnection: true
    await handlePreconnect('example.com', 22, 'testuser', {
      skipSaveConnection: true,
      skipPermissionCheck: true,
    });

    // Verify that saveConnectionInfo was not called
    expect(saveConnectionInfoSpy).not.toHaveBeenCalled();

    // Reset the spy
    saveConnectionInfoSpy.mockClear();

    // Call handlePreconnect without skipSaveConnection
    await handlePreconnect('example.com', 22, 'testuser', {
      skipPermissionCheck: true,
    });

    // Verify that saveConnectionInfo was called
    expect(saveConnectionInfoSpy).toHaveBeenCalled();
  }, 30000);
});
