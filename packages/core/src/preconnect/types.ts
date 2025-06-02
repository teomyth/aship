/**
 * Types for preconnect module
 */

import type { PermissionLevel } from '../ssh/permissions.js';

/**
 * Preconnect server configuration
 */
export interface PreconnectServerConfig {
  name: string;
  hostname: string;
  port: number;
  user: string;
  identity_file?: string;
  variables?: Record<string, any>;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  permissionLevel: PermissionLevel;
  isInSudoGroup?: boolean;
  isInSudoers?: boolean;
  canUseSudoWithoutPassword?: boolean;
  hasError: boolean;
  errorMessage?: string;
}

/**
 * Preconnect connection result
 */
export interface PreconnectConnectionResult {
  success: boolean;
  authType?: string;
  authValue?: string;
  serverConfig?: PreconnectServerConfig;
  errorMessage?: string;
}

/**
 * Preconnect options
 */
export interface PreconnectOptions {
  /** Skip permission check */
  skipPermissionCheck?: boolean;

  /** Skip connection test */
  skipConnectionTest?: boolean;

  /** Skip saving connection information */
  skipSaveConnection?: boolean;

  /** Maximum number of connection retry attempts */
  maxRetryAttempts?: number;

  /** Whether to exit on connection failure */
  exitOnFailure?: boolean;

  /** Whether to exit on permission check failure */
  exitOnPermissionFailure?: boolean;
}

/**
 * Preconnect result
 */
export interface PreconnectResult {
  /** Whether the preconnect process was successful */
  success: boolean;

  /** The server configuration */
  serverConfig?: PreconnectServerConfig;

  /** Permission check result */
  permissionResult?: PermissionCheckResult;

  /** Error message if any */
  errorMessage?: string;
}
