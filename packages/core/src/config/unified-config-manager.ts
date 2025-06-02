/**
 * Unified configuration manager for loading all configuration sources
 */

import * as path from 'node:path';
import * as yaml from 'js-yaml';
import type { HostChoice } from '../schemas/host-config.js';
import type { ProjectConfig, ServersConfig } from '../types/index.js';
import type { ConnectionHistoryEntry } from '../utils/connection-history.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { ConfigurationManager } from './manager.js';
import { RuntimeConfigManager } from './runtime-config-manager.js';

/**
 * Host source types (legacy compatibility)
 */
export type HostSource = 'configured' | 'inventory' | 'history' | 'manual';

/**
 * Unified configuration containing all sources
 */
export interface UnifiedConfig {
  project: ProjectConfig;
  servers: ServersConfig;
  connectionHistory: ConnectionHistoryEntry[];
  inventoryHosts: InventoryHost[];
}

/**
 * Inventory host information
 */
export interface InventoryHost {
  name: string;
  host: string;
  port?: number;
  user?: string;
  connection?: string;
  variables?: Record<string, string | number | boolean>;
}

/**
 * Unified configuration manager class
 */
export class UnifiedConfigManager {
  private projectDir: string;
  private runtimeConfigManager: RuntimeConfigManager;
  private cachedConfig: UnifiedConfig | null = null;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.runtimeConfigManager = new RuntimeConfigManager(projectDir);
  }

  /**
   * Load all configuration sources
   */
  async loadConfig(): Promise<UnifiedConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    logger.debug('Loading unified configuration...');

    // Load project configuration
    const project = await this.loadProjectConfig();

    // Load servers configuration
    const servers = await this.loadServersConfig();

    // Load connection history
    const connectionHistory = await this.loadConnectionHistory();

    // Load inventory hosts
    const inventoryHosts = await this.loadInventoryHosts();

    this.cachedConfig = {
      project,
      servers,
      connectionHistory,
      inventoryHosts,
    };

    logger.debug(
      `Loaded configuration: ${servers.servers.length} servers, ${inventoryHosts.length} inventory hosts, ${connectionHistory.length} recent connections`
    );

    return this.cachedConfig;
  }

  /**
   * Load project configuration from aship.yml
   */
  private async loadProjectConfig(): Promise<ProjectConfig> {
    const configPath = path.join(this.projectDir, 'aship.yml');

    if (!fileExists(configPath)) {
      logger.debug('No aship.yml found, using default project config');
      return {
        name: path.basename(this.projectDir),
        playbooks: {},
        vars: {},
      };
    }

    try {
      const configManager = new ConfigurationManager(configPath);
      return await configManager.loadConfig();
    } catch (error) {
      logger.warn(
        `Failed to load project configuration: ${error instanceof Error ? error.message : String(error)}`
      );
      return {
        name: path.basename(this.projectDir),
        playbooks: {},
        vars: {},
      };
    }
  }

  /**
   * Load servers configuration from .aship/servers.yml
   */
  private async loadServersConfig(): Promise<ServersConfig> {
    try {
      return await this.runtimeConfigManager.loadServers();
    } catch (error) {
      logger.warn(
        `Failed to load servers configuration: ${error instanceof Error ? error.message : String(error)}`
      );
      return { servers: [] };
    }
  }

  /**
   * Load connection history from global cache
   */
  private async loadConnectionHistory(): Promise<ConnectionHistoryEntry[]> {
    try {
      const { ConnectionHistoryManager } = await import('../utils/connection-history.js');
      const historyManager = new ConnectionHistoryManager();
      return await historyManager.getHistory();
    } catch (error) {
      logger.warn(
        `Failed to load connection history: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Load inventory hosts from Ansible inventory files
   */
  private async loadInventoryHosts(): Promise<InventoryHost[]> {
    const inventoryPaths = [
      path.join(this.projectDir, 'inventory', 'hosts.yml'),
      path.join(this.projectDir, 'inventory', 'hosts.yaml'),
      path.join(this.projectDir, 'inventory.yml'),
      path.join(this.projectDir, 'inventory.yaml'),
      path.join(this.projectDir, 'hosts.yml'),
      path.join(this.projectDir, 'hosts.yaml'),
    ];

    const hosts: InventoryHost[] = [];

    for (const inventoryPath of inventoryPaths) {
      if (fileExists(inventoryPath)) {
        logger.debug(`Found inventory file: ${inventoryPath}`);
        try {
          const inventoryHosts = await this.parseInventoryFile(inventoryPath);
          hosts.push(...inventoryHosts);
          break; // Use the first found inventory file
        } catch (error) {
          logger.warn(
            `Failed to parse inventory file ${inventoryPath}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    return hosts;
  }

  /**
   * Parse Ansible inventory file (YAML format)
   */
  private async parseInventoryFile(inventoryPath: string): Promise<InventoryHost[]> {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(inventoryPath, 'utf-8');
    const inventory = yaml.load(content) as Record<string, any> | null;

    const hosts: InventoryHost[] = [];

    if (!inventory || typeof inventory !== 'object') {
      return hosts;
    }

    // Parse 'all' group
    if (inventory.all?.hosts) {
      for (const [hostName, hostConfig] of Object.entries(inventory.all.hosts)) {
        const host = this.parseInventoryHost(hostName, hostConfig as any);
        if (host) {
          hosts.push(host);
        }
      }
    }

    // Parse other groups
    for (const [groupName, groupConfig] of Object.entries(inventory)) {
      if (groupName === 'all') continue;

      if (typeof groupConfig === 'object' && groupConfig && 'hosts' in groupConfig) {
        const group = groupConfig as any;
        if (group.hosts) {
          for (const [hostName, hostConfig] of Object.entries(group.hosts)) {
            // Avoid duplicates
            if (!hosts.find(h => h.name === hostName)) {
              const host = this.parseInventoryHost(hostName, hostConfig as any);
              if (host) {
                hosts.push(host);
              }
            }
          }
        }
      }
    }

    return hosts;
  }

  /**
   * Parse individual inventory host
   */
  private parseInventoryHost(hostName: string, hostConfig: any): InventoryHost | null {
    if (!hostConfig) {
      // Simple host entry without config
      return {
        name: hostName,
        host: hostName,
      };
    }

    const host: InventoryHost = {
      name: hostName,
      host: hostConfig.ansible_host || hostName,
    };

    if (hostConfig.ansible_port) {
      host.port = Number.parseInt(hostConfig.ansible_port, 10);
    }

    if (hostConfig.ansible_user) {
      host.user = hostConfig.ansible_user;
    }

    if (hostConfig.ansible_connection) {
      host.connection = hostConfig.ansible_connection;
    }

    // Collect other variables
    const variables: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(hostConfig)) {
      if (!key.startsWith('ansible_')) {
        // Only include primitive values that can be safely used as variables
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          variables[key] = value;
        }
      }
    }

    if (Object.keys(variables).length > 0) {
      host.variables = variables;
    }

    return host;
  }

  /**
   * Get all available host choices for server selection
   * Simplified to only include configured servers (compatibility mode)
   */
  async getHostChoices(): Promise<HostChoice[]> {
    const config = await this.loadConfig();
    const choices: HostChoice[] = [];

    // Only add configured servers (compatibility mode)
    // Inventory and history sources are removed as per new design
    for (const server of config.servers.servers) {
      const portInfo = server.port && server.port !== 22 ? `:${server.port}` : '';
      const userInfo = server.user ? `${server.user}@` : '';
      choices.push({
        name: `${server.name} (${userInfo}${server.hostname}${portInfo})`,
        value: server.name,
        source: 'aship_host',
        host: server.hostname,
        user: server.user,
        port: server.port,
        description: server.description,
      });
    }

    // Add manual input option
    choices.push({
      name: 'Enter new host...',
      value: 'manual',
      source: 'manual',
      host: '',
      description: 'Input a new host manually',
    });

    return choices;
  }

  /**
   * Clear cached configuration
   */
  clearCache(): void {
    this.cachedConfig = null;
  }
}
