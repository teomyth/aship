/**
 * Enhanced Ansible playbook runner with aship host support
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DirectoryManager } from '../config/directory-manager.js';
import type { HostManager } from '../host/host-manager.js';
import type { InventoryGenerator } from '../inventory/inventory-generator.js';
import type { HostConfig } from '../schemas/host-config.js';
import type { ServerConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { AnsibleExecutor, type AnsiblePlaybookOptions } from './ansible-executor.js';

/**
 * Options for running playbooks with enhanced host support
 */
export interface RunOptions {
  // Existing options (for backward compatibility)
  tags?: string[];
  skipTags?: string[];
  vars?: Record<string, any>;
  verbose?: number;
  dryRun?: boolean;

  // New aship host options
  hosts?: string[]; // aship host names list
  inventory?: string; // inventory file path
  limit?: string; // ansible --limit parameter
  inventoryMode?: 'replace' | 'inject' | 'merge'; // inventory processing mode

  // Additional ansible options
  ansibleArgs?: string[];
  cwd?: string;

  // Event handlers
  events?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onProgress?: (progress: number) => void;
  };
}

/**
 * Enhanced playbook runner that supports aship hosts and inventory integration
 */
export class PlaybookRunner {
  constructor(
    private hostManager: HostManager,
    private inventoryGenerator: InventoryGenerator,
    private directoryManager: DirectoryManager
  ) {}

  /**
   * Run a playbook with enhanced host and inventory support
   */
  async run(playbookPath: string, options: RunOptions = {}): Promise<void> {
    logger.verbose('Starting enhanced playbook execution');

    // Prepare inventory based on options
    const inventoryPath = await this.prepareInventory(options);

    // Convert aship hosts to server configs if needed
    const _servers = await this.prepareServers(options);

    // Build ansible-playbook command options
    const ansibleOptions = await this.buildAnsibleOptions(playbookPath, {
      ...options,
      inventory: inventoryPath,
    });

    try {
      // Execute playbook using AnsibleExecutor
      const executor = new AnsibleExecutor();
      const result = await executor.executePlaybook(ansibleOptions);

      if (!result.success) {
        throw new Error(
          `Playbook execution failed with exit code ${result.exitCode}: ${result.stderr}`
        );
      }

      // Update host usage statistics on success
      if (options.hosts) {
        await this.updateHostUsage(options.hosts);
      }

      logger.verbose('Playbook execution completed successfully');
    } finally {
      // Clean up temporary files
      await this.cleanup(inventoryPath, options);
    }
  }

  /**
   * Prepare inventory based on options
   */
  private async prepareInventory(options: RunOptions): Promise<string | undefined> {
    // If no hosts or inventory specified, use default behavior
    if (!options.hosts && !options.inventory) {
      return undefined; // Let Ansible use default inventory
    }

    // If only aship hosts specified, generate temporary inventory
    if (options.hosts && !options.inventory) {
      return await this.generateTempInventory(options.hosts);
    }

    // If only inventory file specified, use it directly
    if (options.inventory && !options.hosts) {
      return options.inventory;
    }

    // If both specified, handle mixed mode
    return await this.handleMixedMode(options);
  }

  /**
   * Generate temporary inventory from aship hosts
   */
  private async generateTempInventory(hosts: string[]): Promise<string> {
    logger.verbose(`Generating temporary inventory for hosts: ${hosts.join(', ')}`);

    const inventory = await this.inventoryGenerator.generateInventory({
      includeHosts: hosts,
    });

    const tempPath = path.join(this.directoryManager.inventoriesDir, `aship-${Date.now()}.yml`);

    await this.inventoryGenerator.saveInventory(tempPath, inventory);
    logger.verbose(`Temporary inventory saved to: ${tempPath}`);

    return tempPath;
  }

  /**
   * Handle mixed mode (both aship hosts and inventory file)
   */
  private async handleMixedMode(options: RunOptions): Promise<string> {
    const mode = options.inventoryMode || 'inject';

    switch (mode) {
      case 'replace':
        // Ignore existing inventory, only use aship hosts
        logger.verbose('Using replace mode: ignoring existing inventory');
        if (!options.hosts) {
          throw new Error('Hosts are required for replace mode');
        }
        return await this.generateTempInventory(options.hosts);

      case 'inject': {
        // Inject aship hosts into existing inventory
        logger.verbose('Using inject mode: adding aship hosts to existing inventory');
        if (!options.inventory) {
          throw new Error('Inventory is required for inject mode');
        }
        const tempInventory = await this.createTempCopy(options.inventory);
        await this.inventoryGenerator.injectToInventory(tempInventory, {
          includeHosts: options.hosts,
          force: true, // Force injection in temporary copy
        });
        return tempInventory;
      }

      case 'merge':
        // Create new inventory containing both
        logger.verbose('Using merge mode: creating combined inventory');
        return await this.createMergedInventory(options);

      default:
        throw new Error(`Unknown inventory mode: ${mode}`);
    }
  }

  /**
   * Create a temporary copy of inventory file
   */
  private async createTempCopy(inventoryPath: string): Promise<string> {
    const tempPath = path.join(
      this.directoryManager.inventoriesDir,
      `temp-${Date.now()}-${path.basename(inventoryPath)}`
    );

    await fs.copyFile(inventoryPath, tempPath);
    return tempPath;
  }

  /**
   * Create merged inventory from both sources
   */
  private async createMergedInventory(options: RunOptions): Promise<string> {
    // Load existing inventory
    if (!options.inventory) {
      throw new Error('Inventory is required for merge mode');
    }
    const existingInventory = await this.inventoryGenerator.loadInventory(options.inventory);

    // Generate aship inventory
    const ashipInventory = await this.inventoryGenerator.generateInventory({
      includeHosts: options.hosts,
    });

    // Merge inventories
    const merged = this.inventoryGenerator.mergeInventories(existingInventory, ashipInventory);

    // Save to temporary file
    const tempPath = path.join(this.directoryManager.inventoriesDir, `merged-${Date.now()}.yml`);

    await this.inventoryGenerator.saveInventory(tempPath, merged);
    return tempPath;
  }

  /**
   * Prepare server configs for AnsibleExecutor
   */
  private async prepareServers(options: RunOptions): Promise<ServerConfig[]> {
    if (!options.hosts) {
      return []; // No aship hosts specified
    }

    const servers: ServerConfig[] = [];

    for (const hostName of options.hosts) {
      const host = await this.hostManager.getHost(hostName);
      if (!host) {
        throw new Error(`Aship host "${hostName}" not found`);
      }

      servers.push(this.convertHostToServer(host));
    }

    return servers;
  }

  /**
   * Convert HostConfig to ServerConfig
   */
  private convertHostToServer(host: HostConfig): ServerConfig {
    return {
      name: host.name,
      hostname: host.hostname,
      user: host.user,
      port: host.port,
      identity_file: host.identity_file,
      variables: {},
    };
  }

  /**
   * Build options for AnsibleExecutor
   */
  private async buildAnsibleOptions(
    playbookPath: string,
    options: RunOptions & { inventory?: string }
  ): Promise<AnsiblePlaybookOptions> {
    const servers = await this.prepareServers(options);

    // Build ansible arguments
    const ansibleArgs: string[] = [];

    // Add tags
    if (options.tags && options.tags.length > 0) {
      ansibleArgs.push('--tags', options.tags.join(','));
    }

    // Add skip tags
    if (options.skipTags && options.skipTags.length > 0) {
      ansibleArgs.push('--skip-tags', options.skipTags.join(','));
    }

    // Add limit
    if (options.limit) {
      ansibleArgs.push('--limit', options.limit);
    }

    // Add dry run
    if (options.dryRun) {
      ansibleArgs.push('--check');
    }

    // Add additional ansible args
    if (options.ansibleArgs) {
      ansibleArgs.push(...options.ansibleArgs);
    }

    return {
      playbook: playbookPath,
      servers,
      inventoryPath: options.inventory,
      extraVars: options.vars,
      verbose: options.verbose,
      ansibleArgs,
      cwd: options.cwd,
      events: options.events,
    };
  }

  /**
   * Update host usage statistics
   */
  private async updateHostUsage(hosts: string[]): Promise<void> {
    logger.verbose(`Updating usage statistics for hosts: ${hosts.join(', ')}`);

    for (const hostName of hosts) {
      try {
        await this.hostManager.updateUsage(hostName);
      } catch (error) {
        logger.warn(`Failed to update usage for host ${hostName}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Clean up temporary files
   */
  private async cleanup(inventoryPath: string | undefined, _options: RunOptions): Promise<void> {
    if (!inventoryPath) {
      return;
    }

    // Only clean up files in our temp directory
    if (inventoryPath.startsWith(this.directoryManager.inventoriesDir)) {
      try {
        await fs.unlink(inventoryPath);
        logger.verbose(`Cleaned up temporary inventory: ${inventoryPath}`);
      } catch (error) {
        logger.warn(`Failed to clean up temporary inventory: ${(error as Error).message}`);
      }
    }
  }
}
