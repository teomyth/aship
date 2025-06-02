/**
 * Runtime configuration directory management
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  type ServersConfig,
  createDefaultServersConfig,
  validateServersConfig,
} from '../schemas/index.js';
import { fileExists } from '../utils/fs.js';

/**
 * Manages the project's runtime configuration directory for variables, state, and servers
 */
export class RuntimeConfigManager {
  constructor(private projectDir: string) {}

  /**
   * Get the runtime configuration directory path
   */
  private get runtimeDir() {
    return path.join(this.projectDir, '.aship');
  }

  /**
   * Ensure the runtime configuration directory exists
   */
  async ensureDirectory(): Promise<void> {
    await fs.mkdir(this.runtimeDir, { recursive: true });
  }

  /**
   * Save state information to .aship/state.yml
   * @param state State information to save
   */
  async saveState(state: {
    lastRun?: {
      playbook: string;
      servers: string[];
      timestamp: string;
      success: boolean;
    };
    environment?: string;
  }): Promise<void> {
    await this.ensureDirectory();
    const statePath = path.join(this.runtimeDir, 'state.yml');
    await fs.writeFile(statePath, yaml.dump(state));
  }

  /**
   * Load state information from .aship/state.yml
   * @returns Loaded state or empty object if file doesn't exist
   */
  async loadState(): Promise<Record<string, any>> {
    const statePath = path.join(this.runtimeDir, 'state.yml');
    if (await fileExists(statePath)) {
      try {
        const content = await fs.readFile(statePath, 'utf-8');

        // Check if file is empty or contains only whitespace
        if (!content.trim()) {
          return {};
        }

        return (yaml.load(content) as Record<string, any>) || {};
      } catch (error) {
        console.warn(`Failed to load state from ${statePath}: ${error}`);
        // Backup corrupted file
        const backupPath = `${statePath}.backup.${Date.now()}`;
        try {
          const content = await fs.readFile(statePath, 'utf-8');
          await fs.writeFile(backupPath, content, 'utf-8');
          console.warn(`Corrupted state file backed up to: ${backupPath}`);
        } catch (backupError) {
          console.warn(`Failed to backup corrupted state file: ${backupError}`);
        }
        return {};
      }
    }
    return {};
  }

  /**
   * Save servers configuration to .aship/servers.yml
   * @param servers Server configuration to save
   */
  async saveServers(servers: ServersConfig): Promise<void> {
    // Validate servers configuration before saving
    const validation = validateServersConfig(servers);
    if (!validation.success) {
      throw new Error(`Servers configuration validation failed:\n${validation.errors?.join('\n')}`);
    }

    await this.ensureDirectory();
    const serversPath = path.join(this.runtimeDir, 'servers.yml');
    await fs.writeFile(serversPath, yaml.dump(validation.data as ServersConfig));
  }

  /**
   * Load servers configuration from .aship/servers.yml
   * @returns Loaded servers configuration or default if file doesn't exist
   */
  async loadServers(): Promise<ServersConfig> {
    const serversPath = path.join(this.runtimeDir, 'servers.yml');
    if (await fileExists(serversPath)) {
      try {
        const content = await fs.readFile(serversPath, 'utf-8');

        // Check if file is empty or contains only whitespace
        if (!content.trim()) {
          return createDefaultServersConfig();
        }

        const rawConfig = yaml.load(content);

        // Validate loaded configuration
        const validation = validateServersConfig(rawConfig);
        if (!validation.success) {
          console.warn(
            `Servers configuration validation failed:\n${validation.errors?.join('\n')}`
          );
          // Backup invalid file and return default
          const backupPath = `${serversPath}.backup.${Date.now()}`;
          await fs.writeFile(backupPath, content, 'utf-8');
          console.warn(`Invalid servers configuration backed up to: ${backupPath}`);
          return createDefaultServersConfig();
        }

        return validation.data as ServersConfig;
      } catch (error) {
        console.warn(`Failed to load servers configuration from ${serversPath}: ${error}`);
        // Backup corrupted file
        const backupPath = `${serversPath}.backup.${Date.now()}`;
        try {
          const content = await fs.readFile(serversPath, 'utf-8');
          await fs.writeFile(backupPath, content, 'utf-8');
          console.warn(`Corrupted servers configuration backed up to: ${backupPath}`);
        } catch (backupError) {
          console.warn(`Failed to backup corrupted servers configuration: ${backupError}`);
        }
        return createDefaultServersConfig();
      }
    }
    return createDefaultServersConfig();
  }

  /**
   * Check if runtime configuration directory exists
   * @returns True if directory exists
   */
  async exists(): Promise<boolean> {
    try {
      const stats = await fs.stat(this.runtimeDir);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
