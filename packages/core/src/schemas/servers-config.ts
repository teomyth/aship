/**
 * Server configuration schema for .aship/servers.yml
 */

import { z } from 'zod';

/**
 * Schema for individual server configuration
 */
export const ServerConfigSchema = z.object({
  /**
   * Server name (unique identifier)
   */
  name: z.string().min(1, 'Server name cannot be empty'),

  /**
   * Server hostname or IP address
   */
  hostname: z.string().min(1, 'Server hostname cannot be empty'),

  /**
   * SSH port
   */
  port: z.number().int().min(1).max(65535).default(22),

  /**
   * SSH username
   */
  user: z.string().min(1, 'Username cannot be empty'),

  /**
   * SSH identity file path (optional, follows SSH standard authentication flow)
   */
  identity_file: z.string().optional(),

  /**
   * Server tags for grouping and filtering
   */
  tags: z.array(z.string()).optional(),

  /**
   * Server-specific variables
   */
  variables: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),

  /**
   * Server description
   */
  description: z.string().optional(),
});

/**
 * Schema for the complete servers configuration file (.aship/servers.yml)
 */
export const ServersConfigSchema = z
  .object({
    /**
     * List of server configurations
     */
    servers: z.array(ServerConfigSchema).default([]),
  })
  .refine(
    data => {
      // Check for duplicate server names
      const serverNames = data.servers.map(s => s.name);
      const uniqueNames = new Set(serverNames);
      if (serverNames.length !== uniqueNames.size) {
        return false;
      }
      return true;
    },
    {
      message: 'Server names must be unique',
    }
  );

/**
 * TypeScript types
 */
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ServersConfig = z.infer<typeof ServersConfigSchema>;

/**
 * Validate servers configuration
 */
export const validateServersConfig = (
  config: unknown
): {
  success: boolean;
  data?: ServersConfig;
  errors?: string[];
} => {
  try {
    const validatedConfig = ServersConfigSchema.parse(config);
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
 * Create default servers configuration
 */
export const createDefaultServersConfig = (): ServersConfig => ({
  servers: [],
});
