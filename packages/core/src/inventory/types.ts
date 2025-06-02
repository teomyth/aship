/**
 * Options for inventory generation
 */
export interface InventoryOptions {
  /**
   * Filter hosts by name pattern (regex)
   */
  filter?: string;

  /**
   * Filter hosts by source type
   */
  source?: 'manual' | 'ssh_config' | 'imported';

  /**
   * Custom group name for aship hosts
   */
  groupName?: string;

  /**
   * Include only specific hosts by name
   */
  includeHosts?: string[];

  /**
   * Exclude specific hosts by name
   */
  excludeHosts?: string[];
}

/**
 * Options for injecting hosts into existing inventory
 */
export interface InjectOptions extends InventoryOptions {
  /**
   * Force overwrite existing hosts in inventory
   */
  force?: boolean;

  /**
   * Create backup of original file
   */
  backup?: boolean;

  /**
   * Dry run mode - show what would be changed
   */
  dryRun?: boolean;
}

/**
 * Ansible inventory content structure
 */
export interface InventoryContent {
  all: {
    hosts: Record<string, InventoryHostEntry>;
    children?: Record<string, InventoryGroup>;
  };
}

/**
 * Individual host entry in inventory
 */
export interface InventoryHostEntry {
  ansible_host: string;
  ansible_user: string;
  ansible_port: number;
  ansible_ssh_private_key_file?: string;
  ansible_ssh_common_args?: string;
  [key: string]: any;
}

/**
 * Inventory group structure
 */
export interface InventoryGroup {
  hosts: Record<string, Record<string, any>>;
  vars?: Record<string, any>;
}

/**
 * Preview of injection changes
 */
export interface InjectionPreview {
  hostsToAdd: string[];
  hostsToUpdate: string[];
  hostsToSkip: string[];
  groupsToCreate: string[];
  conflicts: string[];
}

/**
 * Supported inventory formats
 */
export type InventoryFormat = 'yaml' | 'json';
