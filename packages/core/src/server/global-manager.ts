/**
 * Global server manager for managing server connections across projects
 */

import os from 'node:os';
import { RuntimeConfigManager } from '../config/runtime-config-manager.js';
import type { ServerConfig, ServersConfig } from '../schemas/index.js';
import { testConnection } from '../utils/ssh.js';

/**
 * Default server configuration
 */
const DEFAULT_SERVER_CONFIG: Partial<ServerConfig> = {
  port: 22,
};

/**
 * Global server manager class
 */
class GlobalServerManager {
  /**
   * Runtime configuration manager for global config
   */
  private runtimeConfigManager: RuntimeConfigManager;

  /**
   * Cached servers configuration
   */
  private serversConfig: ServersConfig | null = null;

  /**
   * Constructor
   */
  constructor() {
    // Use home directory for global configuration
    this.runtimeConfigManager = new RuntimeConfigManager(os.homedir());
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
    const config = await this.loadServersConfig();
    return config.servers;
  }

  /**
   * Get a server by name
   * @param name Server name
   * @returns Server configuration or null if not found
   */
  async getServer(name: string): Promise<ServerConfig | null> {
    const servers = await this.getServers();
    const server = servers.find(s => s.name === name);
    return server || null;
  }

  /**
   * Add a new server
   * @param server Server configuration
   * @returns Added server
   */
  async addServer(server: ServerConfig): Promise<ServerConfig> {
    // Check if server already exists
    const existingServer = await this.getServer(server.name);
    if (existingServer) {
      throw new Error(`Server "${server.name}" already exists`);
    }

    // Apply defaults
    const newServer: ServerConfig = {
      ...(DEFAULT_SERVER_CONFIG as ServerConfig),
      ...server,
    };

    // Load current configuration
    const config = await this.loadServersConfig();

    // Add server to configuration
    const updatedConfig: ServersConfig = {
      ...config,
      servers: [...config.servers, newServer],
    };

    // Save updated configuration
    await this.saveServersConfig(updatedConfig);

    return newServer;
  }

  /**
   * Update a server
   * @param name Server name
   * @param server Updated server configuration
   * @returns Updated server
   */
  async updateServer(name: string, server: Partial<ServerConfig>): Promise<ServerConfig> {
    const config = await this.loadServersConfig();
    const servers = config.servers;
    const index = servers.findIndex(s => s.name === name);

    if (index === -1) {
      throw new Error(`Server "${name}" not found`);
    }

    // Update server
    const updatedServer: ServerConfig = {
      ...servers[index],
      ...server,
      name: server.name || name, // Allow name update
    };

    // Update servers array
    const updatedServers = [...servers];
    updatedServers[index] = updatedServer;

    const updatedConfig: ServersConfig = {
      ...config,
      servers: updatedServers,
    };

    // Save updated configuration
    await this.saveServersConfig(updatedConfig);

    return updatedServer;
  }

  /**
   * Remove a server
   * @param name Server name
   * @returns True if server was removed, false otherwise
   */
  async removeServer(name: string): Promise<boolean> {
    const config = await this.loadServersConfig();
    const servers = config.servers;
    const filteredServers = servers.filter(s => s.name !== name);

    if (filteredServers.length === servers.length) {
      return false;
    }

    const updatedConfig: ServersConfig = {
      ...config,
      servers: filteredServers,
    };

    // Save updated configuration
    await this.saveServersConfig(updatedConfig);
    return true;
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

export { GlobalServerManager };
