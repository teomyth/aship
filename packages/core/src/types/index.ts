/**
 * Common type definitions for Aship
 *
 * Note: Core configuration types are now defined in schemas/
 * This file contains legacy and utility types
 */

// Re-export schema-based types for backward compatibility
export type {
  ProjectConfig,
  ServerConfig,
  ServersConfig,
  VariableDefinition,
} from '../schemas/index.js';

// Ansible configuration types
export interface AnsibleConfig {
  /**
   * Path to ansible.cfg file
   */
  configPath?: string;
}

// Legacy types - these are now defined in schemas but kept here for compatibility

// Execution result types
export interface ExecutionResult {
  /**
   * Execution success status
   */
  success: boolean;

  /**
   * Exit code
   */
  exitCode: number;

  /**
   * Standard output
   */
  stdout?: string;

  /**
   * Standard error
   */
  stderr?: string;

  /**
   * Execution time in milliseconds
   */
  executionTime?: number;
}

// Error types
export interface AshipError extends Error {
  /**
   * Error code
   */
  code?: string;

  /**
   * Additional details
   */
  details?: Record<string, any>;
}
