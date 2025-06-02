/**
 * Tests for ServerManager
 */

import { vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

// Mock utils
vi.mock('../../../src/utils/ssh.js', () => ({
  testConnection: vi.fn(),
}));

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { ServerConfig as BaseServerConfig } from '../../../src/types/index.js';
import { testConnection } from '../../../src/utils/ssh.js';
import { DirectoryManager } from '../../../src/config/directory-manager.js';
import { HostManager } from '../../../src/host/host-manager.js';

// 扩展ServerConfig类型，添加测试中使用的额外字段
interface ServerConfig extends BaseServerConfig {
  host?: string;
  auth?: {
    type: 'key' | 'password';
    keyPath?: string;
  };
}

// Create a test version of ServerManager that uses a test directory
class TestServerManager {
  private hostManager: HostManager;

  constructor(testDir: string) {
    // Create a test DirectoryManager
    class TestDirectoryManager extends DirectoryManager {
      private readonly testGlobalDir: string;

      constructor() {
        super();
        this.testGlobalDir = path.join(testDir, '.aship');
      }

      get configFile(): string {
        return path.join(this.testGlobalDir, 'config.yml');
      }

      get hostsFile(): string {
        return path.join(this.testGlobalDir, 'hosts.yml');
      }

      get recentConnectionFile(): string {
        return path.join(this.testGlobalDir, 'recent-connection.json');
      }

      get hostUsageFile(): string {
        return path.join(this.testGlobalDir, 'host-usage.json');
      }

      get logsDir(): string {
        return path.join(this.testGlobalDir, 'logs');
      }

      get mainLogFile(): string {
        return path.join(this.logsDir, 'aship.log');
      }

      get ansibleRunsDir(): string {
        return path.join(this.logsDir, 'ansible');
      }
      
      get cacheDir(): string {
        return path.join(this.testGlobalDir, 'cache');
      }
      
      get configDir(): string {
        return path.join(this.testGlobalDir, 'config');
      }
      
      get ansibleConfigFile(): string {
        return path.join(this.configDir, 'ansible.manifest.json');
      }
      
      get ansibleParamsFile(): string {
        return this.ansibleConfigFile;
      }

      get tempDir(): string {
        return path.join(this.testGlobalDir, 'temp');
      }

      get inventoriesDir(): string {
        return path.join(this.tempDir, 'inventories');
      }

      get sessionDir(): string {
        return path.join(this.tempDir, 'session');
      }

      // Legacy methods removed, backward compatibility no longer needed
    }

    const directoryManager = new TestDirectoryManager();
    this.hostManager = new HostManager(directoryManager);
  }

  // Implement ServerManager interface
  private hostToServer(host: any): ServerConfig {
    return {
      name: host.name,
      host: host.hostname,
      hostname: host.hostname,
      user: host.user,
      port: host.port,
      identity_file: host.identity_file,
      description: host.description,
      auth: {
        type: host.identity_file ? 'key' : 'password',
        keyPath: host.identity_file,
      },
    };
  }

  private serverToHost(server: ServerConfig) {
    return {
      hostname: server.host || server.hostname || server.name,
      user: server.user,
      port: server.port || 22,
      identity_file: server.identity_file || server.auth?.keyPath,
      description: server.description,
      source: 'imported' as const,
    };
  }

  async getServers(): Promise<ServerConfig[]> {
    const hosts = await this.hostManager.getHosts();
    return hosts.map(host => this.hostToServer(host));
  }

  async getServer(name: string): Promise<ServerConfig | null> {
    const host = await this.hostManager.getHost(name);
    return host ? this.hostToServer(host) : null;
  }

  async addServer(server: ServerConfig): Promise<ServerConfig> {
    const hostData = this.serverToHost(server);
    const addedHost = await this.hostManager.addHost(hostData, server.name);
    return this.hostToServer(addedHost);
  }

  async updateServer(name: string, server: Partial<ServerConfig>): Promise<ServerConfig> {
    const existingHost = await this.hostManager.getHost(name);
    if (!existingHost) {
      throw new Error(`Server "${name}" not found`);
    }

    await this.hostManager.removeHost(name);

    const existingServer = this.hostToServer(existingHost);
    const updatedServer: ServerConfig = {
      ...existingServer,
      ...server,
      name: server.name || name,
    };

    const hostData = this.serverToHost(updatedServer);
    const addedHost = await this.hostManager.addHost(hostData, updatedServer.name);
    return this.hostToServer(addedHost);
  }

  async removeServer(name: string): Promise<boolean> {
    try {
      await this.hostManager.removeHost(name);
      return true;
    } catch (error) {
      return false;
    }
  }

  async testConnection(name: string): Promise<{ success: boolean; message: string }> {
    const server = await this.getServer(name);
    if (!server) {
      return {
        success: false,
        message: `Server "${name}" not found`,
      };
    }

    return await testConnection(server);
  }
}

describe('ServerManager', () => {
  // Sample server configurations
  const sampleServer1: ServerConfig = {
    name: 'server1',
    hostname: 'example.com', // 必需字段
    host: 'example.com',
    port: 22,
    user: 'admin',
    auth: {
      type: 'key',
      keyPath: '/path/to/key.pem',
    },
  };

  const sampleServer2: ServerConfig = {
    name: 'server2',
    hostname: 'example2.com', // 必需字段
    host: 'example2.com',
    port: 2222,
    user: 'user',
    auth: {
      type: 'password',
    },
  };

  let manager: TestServerManager;
  let tempDir: string;

  beforeEach(async () => {
    // Reset mocks
    vi.resetAllMocks();

    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'server-manager-test-'));

    // Create a fresh manager instance
    manager = new TestServerManager(tempDir);
  });

  afterEach(async () => {
    // Restore mocks
    vi.resetAllMocks();

    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getServers', () => {
    it('should return empty array when no servers exist', async () => {
      const servers = await manager.getServers();
      expect(servers).toHaveLength(0);
    });

    it('should return all servers after adding them', async () => {
      // Add a server first
      await manager.addServer(sampleServer1);

      const servers = await manager.getServers();

      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe(sampleServer1.name);
      expect(servers[0].host).toBe(sampleServer1.host);
      expect(servers[0].user).toBe(sampleServer1.user);
      expect(servers[0].port).toBe(sampleServer1.port);
    });
  });

  describe('getServer', () => {
    it('should return null for non-existent server', async () => {
      const server = await manager.getServer('non-existent');
      expect(server).toBeNull();
    });

    it('should return server by name after adding it', async () => {
      // Add a server first
      await manager.addServer(sampleServer1);

      const server = await manager.getServer('server1');

      expect(server).not.toBeNull();
      expect(server!.name).toBe(sampleServer1.name);
      expect(server!.host).toBe(sampleServer1.host);
      expect(server!.user).toBe(sampleServer1.user);
      expect(server!.port).toBe(sampleServer1.port);
    });
  });

  describe('addServer', () => {
    it('should add a new server', async () => {
      const addedServer = await manager.addServer(sampleServer2);

      expect(addedServer.name).toBe(sampleServer2.name);
      expect(addedServer.host).toBe(sampleServer2.host);
      expect(addedServer.user).toBe(sampleServer2.user);
      expect(addedServer.port).toBe(sampleServer2.port);
      expect(addedServer.auth?.type).toBe(sampleServer2.auth?.type);
    });

    it('should throw error when server with same name exists', async () => {
      // Add server first
      await manager.addServer(sampleServer1);

      // Try to add same server again
      await expect(manager.addServer(sampleServer1)).rejects.toThrow('Host "server1" already exists');
    });

    it('should apply default values', async () => {
      const minimalServer: Partial<ServerConfig> &
        Pick<ServerConfig, 'name' | 'host' | 'user' | 'auth'> = {
        name: 'minimal',
        host: 'minimal.com',
        user: 'user',
        auth: {
          type: 'key',
        },
      };

      const addedServer = await manager.addServer(minimalServer as ServerConfig);

      // Should have default port
      expect(addedServer.port).toBe(22);
      expect(addedServer.name).toBe('minimal');
      expect(addedServer.host).toBe('minimal.com');
    });
  });

  describe('updateServer', () => {
    it('should throw error for non-existent server', async () => {
      await expect(manager.updateServer('non-existent', { host: 'new.com' })).rejects.toThrow('Server "non-existent" not found');
    });

    it('should update an existing server', async () => {
      // Add server first
      await manager.addServer(sampleServer1);

      const updates = {
        host: 'updated.com',
        port: 2222,
      };

      const updatedServer = await manager.updateServer('server1', updates);

      expect(updatedServer.host).toBe('updated.com');
      expect(updatedServer.port).toBe(2222);
      // Should preserve other fields
      expect(updatedServer.name).toBe('server1');
      expect(updatedServer.user).toBe('admin');
    });

    it('should update server name if provided', async () => {
      // Add server first
      await manager.addServer(sampleServer1);

      const updates = {
        name: 'renamed-server',
      };

      const updatedServer = await manager.updateServer('server1', updates);

      expect(updatedServer.name).toBe('renamed-server');

      // Verify old name no longer exists
      const oldServer = await manager.getServer('server1');
      expect(oldServer).toBeNull();

      // Verify new name exists
      const newServer = await manager.getServer('renamed-server');
      expect(newServer).not.toBeNull();
    });
  });

  describe('removeServer', () => {
    it('should return false for non-existent server', async () => {
      const result = await manager.removeServer('non-existent');
      expect(result).toBe(false);
    });

    it('should remove an existing server', async () => {
      // Add server first
      await manager.addServer(sampleServer1);

      // Verify it exists
      const serverBefore = await manager.getServer('server1');
      expect(serverBefore).not.toBeNull();

      // Remove it
      const result = await manager.removeServer('server1');
      expect(result).toBe(true);

      // Verify it's gone
      const serverAfter = await manager.getServer('server1');
      expect(serverAfter).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should return error for non-existent server', async () => {
      const result = await manager.testConnection('non-existent');

      expect(testConnection).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should test connection to an existing server', async () => {
      // Add server first
      await manager.addServer(sampleServer1);

      // Mock successful connection test
      (testConnection as any).mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      const result = await manager.testConnection('server1');

      expect(testConnection).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');

      // Verify the server config passed to testConnection has correct structure
      const callArgs = (testConnection as any).mock.calls[0][0];
      expect(callArgs.name).toBe('server1');
      expect(callArgs.host).toBe('example.com');
      expect(callArgs.user).toBe('admin');
    });

    it('should handle connection failures', async () => {
      // Add server first
      await manager.addServer(sampleServer1);

      // Mock failed connection test
      (testConnection as any).mockResolvedValue({
        success: false,
        message: 'Connection failed',
      });

      const result = await manager.testConnection('server1');

      expect(testConnection).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection failed');
    });
  });
});
