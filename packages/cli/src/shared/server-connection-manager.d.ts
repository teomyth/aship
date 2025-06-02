import type { ServerConfig } from '@aship/core';
/**
 * Connection mode options
 */
export type ConnectionMode = 'direct' | 'named' | 'interactive' | 'reuse';
/**
 * Options for resolving target servers
 */
export interface ResolveServerOptions {
  /**
   * Connection mode
   */
  connectionMode: ConnectionMode;
  /**
   * Host name or IP address (for direct mode)
   */
  host?: string;
  /**
   * Username (for direct mode)
   */
  user?: string;
  /**
   * Password (for direct mode)
   */
  password?: string;
  /**
   * SSH key path (for direct mode)
   */
  key?: string;
  /**
   * Server names (for named mode)
   */
  server?: string;
  /**
   * Non-interactive mode flag
   */
  nonInteractive?: boolean;
}
/**
 * Result of resolving target servers
 */
export interface ResolveServerResult {
  /**
   * Target server configurations
   */
  targetServers: ServerConfig[];
  /**
   * Direct server configuration (if created)
   */
  directServerConfig?: ServerConfig;
}
/**
 * Resolve target servers based on connection mode and options
 * @param config Configuration object
 * @param options Connection options
 * @returns Target servers
 */
export declare function resolveTargetServers(
  config: any,
  options: ResolveServerOptions
): Promise<ResolveServerResult>;
/**
 * Determine connection mode based on options
 * @param options Command options
 * @param globalOptions Global options
 * @returns Connection mode
 */
export declare function determineConnectionMode(options: any, globalOptions: any): ConnectionMode;
/**
 * Load configuration from file
 * @param currentDir Current working directory
 * @returns Configuration object
 */
export declare function loadConfiguration(currentDir: string): Promise<any>;
/**
 * Save partial connection information
 * This function saves connection information even if the connection process was interrupted
 * @param host Host name or IP address
 * @param user Username
 * @returns True if connection information was saved, false otherwise
 */
export declare function savePartialConnectionInfo(host?: string, user?: string): Promise<boolean>;
//# sourceMappingURL=server-connection-manager.d.ts.map
