/**
 * Host configuration schema for hosts.yml
 */

import { z } from 'zod';

/**
 * Schema for individual host configuration
 */
export const HostConfigSchema = z.object({
  /**
   * Host name (unique identifier)
   */
  name: z.string().min(1, 'Host name cannot be empty'),

  /**
   * Host hostname or IP address
   */
  hostname: z.string().min(1, 'Host hostname cannot be empty'),

  /**
   * SSH username
   */
  user: z.string().min(1, 'Username cannot be empty'),

  /**
   * SSH port
   */
  port: z.number().int().min(1).max(65535).default(22),

  /**
   * SSH identity file path (optional)
   */
  identity_file: z.string().optional(),

  /**
   * Host description
   */
  description: z.string().optional(),

  /**
   * Host creation timestamp
   */
  created_at: z.string(),

  /**
   * Host source type
   */
  source: z.enum(['manual', 'ssh_config', 'imported']).default('manual'),

  /**
   * First successful connection timestamp
   */
  connection_success_at: z.string().optional(),
});

/**
 * Schema for the complete hosts configuration file (hosts.yml)
 */
export const HostsConfigSchema = z
  .object({
    /**
     * Map of host configurations by name
     */
    hosts: z.record(z.string(), HostConfigSchema).default({}),
  })
  .refine(
    data => {
      // Ensure host names match the keys in the hosts object
      for (const [key, host] of Object.entries(data.hosts)) {
        if (host.name !== key) {
          return false;
        }
      }
      return true;
    },
    {
      message: 'Host names must match their keys in the hosts object',
    }
  );

/**
 * Schema for host usage statistics
 */
export const HostUsageSchema = z.object({
  /**
   * First time this host was used
   */
  first_used: z.string(),

  /**
   * Last time this host was used
   */
  last_used: z.string(),

  /**
   * Number of times this host has been used
   */
  use_count: z.number().int().min(0).default(0),
});

/**
 * Schema for host usage history file (host-usage.json)
 */
export const HostUsageHistorySchema = z.record(z.string(), HostUsageSchema).default({});

/**
 * Schema for recent connection information
 */
export const RecentConnectionSchema = z.object({
  /**
   * Host hostname or IP
   */
  host: z.string().min(1),

  /**
   * SSH username (optional)
   */
  user: z.string().optional(),

  /**
   * SSH port (optional)
   */
  port: z.number().int().min(1).max(65535).optional(),

  /**
   * Last input time
   */
  lastInputTime: z.string(),

  /**
   * Last connection attempt time (optional)
   */
  lastConnectionAttempt: z.string().optional(),

  /**
   * Whether last connection was successful (optional)
   */
  lastConnectionSuccess: z.boolean().optional(),

  /**
   * Number of connection attempts
   */
  connectionAttempts: z.number().int().min(0).default(0),

  /**
   * Authentication type (optional)
   */
  authType: z.enum(['key', 'password']).optional(),

  /**
   * Authentication value - key path or encrypted password (optional)
   */
  authValue: z.string().optional(),
});

/**
 * TypeScript types
 */
export type HostConfig = z.infer<typeof HostConfigSchema>;
export type HostsConfig = z.infer<typeof HostsConfigSchema>;
export type HostUsage = z.infer<typeof HostUsageSchema>;
export type HostUsageHistory = z.infer<typeof HostUsageHistorySchema>;
export type RecentConnection = z.infer<typeof RecentConnectionSchema>;

/**
 * Host choice for interactive selection
 */
export interface HostChoice {
  name: string;
  value: string;
  source: 'aship_host' | 'recent' | 'manual';
  isDefault?: boolean;
  lastUsed?: number; // Changed to number for timestamp comparison
  description?: string;
  host?: string;
  user?: string;
  port?: number;
}

/**
 * Validate hosts configuration
 */
export const validateHostsConfig = (
  config: unknown
): {
  success: boolean;
  data?: HostsConfig;
  errors?: string[];
} => {
  try {
    const validatedConfig = HostsConfigSchema.parse(config);
    return {
      success: true,
      data: validatedConfig,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
};

/**
 * Validate host usage history
 */
export const validateHostUsageHistory = (
  usage: unknown
): {
  success: boolean;
  data?: HostUsageHistory;
  errors?: string[];
} => {
  try {
    const validatedUsage = HostUsageHistorySchema.parse(usage);
    return {
      success: true,
      data: validatedUsage,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
};

/**
 * Validate recent connection
 */
export const validateRecentConnection = (
  connection: unknown
): {
  success: boolean;
  data?: RecentConnection;
  errors?: string[];
} => {
  try {
    const validatedConnection = RecentConnectionSchema.parse(connection);
    return {
      success: true,
      data: validatedConnection,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
      };
    }
    return {
      success: false,
      errors: [error instanceof Error ? error.message : 'Unknown validation error'],
    };
  }
};

/**
 * Create default hosts configuration
 */
export const createDefaultHostsConfig = (): HostsConfig => ({
  hosts: {},
});

/**
 * Create default host usage history
 */
export const createDefaultHostUsageHistory = (): HostUsageHistory => ({});
