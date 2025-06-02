/**
 * Server manager for managing server connections
 * Now uses HostManager internally for compatibility
 */

import { DirectoryManager } from '../config/directory-manager.js';
import { RuntimeConfigManager } from '../config/runtime-config-manager.js';
import { HostManager } from '../host/host-manager.js';
import type { HostConfig } from '../schemas/host-config.js';
import type { ServerConfig, ServersConfig } from '../types/index.js';
import { testConnection } from '../utils/ssh.js';

/**
 * Default server configuration
 */
const _DEFAULT_SERVER_CONFIG: Partial<ServerConfig> = {
  port: 22,
};

/**
 * Server manager class - now uses HostManager internally
 */
class ServerManager {
  /**
   * Runtime configuration manager (for backward compatibility)
   */
  private runtimeConfigManager: RuntimeConfigManager;

  /**
   * Host manager (new implementation)
   */
  private hostManager: HostManager;

  /**
   * Cached servers configuration
   */
  private serversConfig: ServersConfig | null = null;

  /**
   * Constructor
   * @param projectDir Project directory path
   */
  constructor(projectDirPath: string) {
    this.runtimeConfigManager = new RuntimeConfigManager(projectDirPath);
    this.hostManager = new HostManager(new DirectoryManager());
  }

  /**
   * Convert HostConfig to ServerConfig for backward compatibility
   */
  private hostToServer(host: HostConfig): ServerConfig {
    return {
      name: host.name,
      hostname: host.hostname,
      user: host.user,
      port: host.port,
      identity_file: host.identity_file,
      description: host.description,
      // Note: tags and variables are not supported in HostConfig
      // These are legacy ServerConfig features
    };
  }

  /**
   * Convert ServerConfig to HostConfig for new system
   */
  private serverToHost(
    server: ServerConfig
  ): Omit<HostConfig, 'name' | 'created_at' | 'connection_success_at'> {
    return {
      hostname: server.hostname || server.name, // Use hostname, then name as fallback
      user: server.user,
      port: server.port || 22,
      identity_file: server.identity_file,
      description: server.description,
      source: 'imported',
    };
  }

  /**
   * Load servers configuration
   * @returns Servers configuration
   */
  private async loadServersConfig(): Promise<ServersConfig> {
    if (!this.serversConfig) {
      this.serversConfig = await this.runtimeConfigManager.loadServers();
    }
    return this.serversConfig;
  }

  /**
   * Save servers configuration
   * @param config Servers configuration to save
   */
  private async saveServersConfig(config: ServersConfig): Promise<void> {
    await this.runtimeConfigManager.saveServers(config);
    this.serversConfig = config;
  }

  /**
   * Get all servers
   * @returns List of servers
   */
  async getServers(): Promise<ServerConfig[]> {
    // Use HostManager for new implementation
    const hosts = await this.hostManager.getHosts();
    return hosts.map(host => this.hostToServer(host));
  }

  /**
   * Get a server by name
   * @param name Server name
   * @returns Server configuration or null if not found
   */
  async getServer(name: string): Promise<ServerConfig | null> {
    const host = await this.hostManager.getHost(name);
    return host ? this.hostToServer(host) : null;
  }

  /**
   * Add a new server
   * @param server Server configuration
   * @returns Added server
   */
  async addServer(server: ServerConfig): Promise<ServerConfig> {
    // Convert to HostConfig and add via HostManager with custom name
    const hostData = this.serverToHost(server);
    const addedHost = await this.hostManager.addHost(hostData, server.name);
    return this.hostToServer(addedHost);
  }

  /**
   * Update a server
   * @param name Server name
   * @param server Updated server configuration
   * @returns Updated server
   */
  async updateServer(name: string, server: Partial<ServerConfig>): Promise<ServerConfig> {
    // For now, we'll implement this by removing and re-adding
    // This is a simplified approach for the compatibility layer
    const existingHost = await this.hostManager.getHost(name);
    if (!existingHost) {
      throw new Error(`Server "${name}" not found`);
    }

    // Remove the old host
    await this.hostManager.removeHost(name);

    // Create updated server config
    const existingServer = this.hostToServer(existingHost);
    const updatedServer: ServerConfig = {
      ...existingServer,
      ...server,
      name: server.name || name,
    };

    // Add the updated host
    const hostData = this.serverToHost(updatedServer);
    const addedHost = await this.hostManager.addHost(hostData, updatedServer.name);
    return this.hostToServer(addedHost);
  }

  /**
   * Remove a server
   * @param name Server name
   * @returns True if server was removed, false otherwise
   */
  async removeServer(name: string): Promise<boolean> {
    try {
      await this.hostManager.removeHost(name);
      return true;
    } catch (_error) {
      // Host not found
      return false;
    }
  }

  /**
   * Test connection to a server
   * @param name Server name
   * @returns Connection test result
   */
  async testConnection(name: string): Promise<{ success: boolean; message: string }> {
    const server = await this.getServer(name);

    if (!server) {
      return {
        success: false,
        message: `Server "${name}" not found`,
      };
    }

    return testConnection(server);
  }
}

export { ServerManager };
