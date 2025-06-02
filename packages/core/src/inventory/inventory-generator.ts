/**
 * Ansible inventory generator
 */

import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import type { HostManager } from '../host/host-manager.js';
import type { HostConfig } from '../schemas/host-config.js';
import { logger } from '../utils/logger.js';
import type {
  InjectOptions,
  InjectionPreview,
  InventoryContent,
  InventoryFormat,
  InventoryHostEntry,
  InventoryOptions,
} from './types.js';

/**
 * Inventory generator class for creating Ansible inventory files
 */
export class InventoryGenerator {
  constructor(private hostManager: HostManager) {}

  /**
   * Generate complete inventory content
   */
  async generateInventory(options: InventoryOptions = {}): Promise<InventoryContent> {
    const hosts = await this.hostManager.getHosts();
    const filteredHosts = this.filterHosts(hosts, options);

    const inventoryHosts = this.convertHostsToInventory(filteredHosts);
    const groupName = options.groupName || 'aship_hosts';

    return {
      all: {
        hosts: inventoryHosts,
        children: {
          [groupName]: {
            hosts: this.createHostsGroup(filteredHosts),
          },
        },
      },
    };
  }

  /**
   * Filter hosts based on options
   */
  private filterHosts(hosts: HostConfig[], options: InventoryOptions): HostConfig[] {
    let filtered = [...hosts];

    // Filter by source
    if (options.source) {
      filtered = filtered.filter(host => host.source === options.source);
    }

    // Filter by name pattern
    if (options.filter) {
      const regex = new RegExp(options.filter, 'i');
      filtered = filtered.filter(host => regex.test(host.name) || regex.test(host.hostname));
    }

    // Include specific hosts
    if (options.includeHosts && options.includeHosts.length > 0) {
      filtered = filtered.filter(host => options.includeHosts?.includes(host.name));
    }

    // Exclude specific hosts
    if (options.excludeHosts && options.excludeHosts.length > 0) {
      filtered = filtered.filter(host => !options.excludeHosts?.includes(host.name));
    }

    return filtered;
  }

  /**
   * Convert host configurations to Ansible inventory format
   */
  private convertHostsToInventory(hosts: HostConfig[]): Record<string, InventoryHostEntry> {
    const inventoryHosts: Record<string, InventoryHostEntry> = {};

    for (const host of hosts) {
      const entry: InventoryHostEntry = {
        ansible_host: host.hostname,
        ansible_user: host.user,
        ansible_port: host.port,
        ansible_ssh_common_args: '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
      };

      if (host.identity_file) {
        entry.ansible_ssh_private_key_file = host.identity_file;
      }

      inventoryHosts[host.name] = entry;
    }

    return inventoryHosts;
  }

  /**
   * Create hosts group for aship hosts
   */
  private createHostsGroup(hosts: HostConfig[]): Record<string, Record<string, any>> {
    const group: Record<string, Record<string, any>> = {};

    for (const host of hosts) {
      group[host.name] = {};
    }

    return group;
  }

  /**
   * Format inventory content as string
   */
  formatInventory(inventory: InventoryContent, format: InventoryFormat = 'yaml'): string {
    if (format === 'json') {
      return JSON.stringify(inventory, null, 2);
    }

    return yaml.dump(inventory, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      sortKeys: true,
    });
  }

  /**
   * Save inventory to file
   */
  async saveInventory(
    filePath: string,
    inventory: InventoryContent,
    format: InventoryFormat = 'yaml'
  ): Promise<void> {
    const content = this.formatInventory(inventory, format);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.verbose(`Inventory saved to ${filePath}`);
  }

  /**
   * Load existing inventory file
   */
  async loadInventory(filePath: string): Promise<InventoryContent> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to parse as YAML first, then JSON
      try {
        const parsed = yaml.load(content) as InventoryContent;
        return this.normalizeInventory(parsed);
      } catch {
        const parsed = JSON.parse(content) as InventoryContent;
        return this.normalizeInventory(parsed);
      }
    } catch (error) {
      throw new Error(`Failed to load inventory from ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Normalize inventory structure
   */
  private normalizeInventory(inventory: any): InventoryContent {
    if (!inventory || typeof inventory !== 'object') {
      throw new Error('Invalid inventory format');
    }

    // Ensure basic structure exists
    if (!inventory.all) {
      inventory.all = {};
    }

    if (!inventory.all.hosts) {
      inventory.all.hosts = {};
    }

    if (!inventory.all.children) {
      inventory.all.children = {};
    }

    return inventory as InventoryContent;
  }

  /**
   * Merge two inventory structures
   */
  mergeInventories(existing: InventoryContent, ashipInventory: InventoryContent): InventoryContent {
    const merged: InventoryContent = {
      all: {
        hosts: {
          ...existing.all.hosts,
          ...ashipInventory.all.hosts,
        },
        children: {
          ...existing.all.children,
          ...ashipInventory.all.children,
        },
      },
    };

    return merged;
  }

  /**
   * Preview injection changes
   */
  async previewInjection(
    inventoryPath: string,
    options: InjectOptions = {}
  ): Promise<InjectionPreview> {
    const existing = await this.loadInventory(inventoryPath);
    const ashipInventory = await this.generateInventory(options);

    const preview: InjectionPreview = {
      hostsToAdd: [],
      hostsToUpdate: [],
      hostsToSkip: [],
      groupsToCreate: [],
      conflicts: [],
    };

    // Check hosts
    for (const hostName of Object.keys(ashipInventory.all.hosts)) {
      if (existing.all.hosts[hostName]) {
        if (options.force) {
          preview.hostsToUpdate.push(hostName);
        } else {
          preview.hostsToSkip.push(hostName);
          preview.conflicts.push(`Host "${hostName}" already exists`);
        }
      } else {
        preview.hostsToAdd.push(hostName);
      }
    }

    // Check groups
    if (ashipInventory.all.children) {
      for (const groupName of Object.keys(ashipInventory.all.children)) {
        if (!existing.all.children || !existing.all.children[groupName]) {
          preview.groupsToCreate.push(groupName);
        }
      }
    }

    return preview;
  }

  /**
   * Inject aship hosts into existing inventory file
   */
  async injectToInventory(inventoryPath: string, options: InjectOptions = {}): Promise<void> {
    // Create backup if requested
    if (options.backup) {
      const backupPath = `${inventoryPath}.backup`;
      await fs.copyFile(inventoryPath, backupPath);
      logger.verbose(`Created backup: ${backupPath}`);
    }

    const existing = await this.loadInventory(inventoryPath);
    const ashipInventory = await this.generateInventory(options);

    // Check for conflicts if force is not enabled
    if (!options.force) {
      const conflicts: string[] = [];
      for (const hostName of Object.keys(ashipInventory.all.hosts)) {
        if (existing.all.hosts[hostName]) {
          conflicts.push(hostName);
        }
      }

      if (conflicts.length > 0) {
        throw new Error(
          `Conflicts detected for hosts: ${conflicts.join(', ')}. Use --force to overwrite.`
        );
      }
    }

    const merged = this.mergeInventories(existing, ashipInventory);
    await this.saveInventory(inventoryPath, merged);
    logger.verbose(`Injected aship hosts into ${inventoryPath}`);
  }
}
