/**
 * Preconnect module
 *
 * This module provides functionality for pre-connection and pre-processing
 * steps that are common across different commands.
 */

// Export functions
export * from './permission-check.js';
export * from './server-connect.js';
export * from './preconnect-handler.js';

// Re-export types from types.js
export type {
  PreconnectServerConfig as ServerConfig,
  PreconnectConnectionResult as ConnectionResult,
  PermissionCheckResult,
  PreconnectOptions,
  PreconnectResult,
} from './types.js';
