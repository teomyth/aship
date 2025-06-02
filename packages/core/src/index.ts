/**
 * Core functionality for Aship
 */

// Export core functionality
export * from './ansible/index.js';
export * from './config/index.js';
export * from './server/index.js';
export * from './host/index.js';
export * from './inventory/index.js';
export * from './variables/index.js';
export * from './ssh/index.js';
export * from './schemas/index.js';

// Export preconnect module functions
export {
  handlePreconnect,
  handleMultiplePreconnect,
  connectToServer,
  saveConnectionInfo,
  testConnectionWithRetry,
  verifyUserPermissions,
  checkUserPermissions,
  displayPermissionCheckResults,
} from './preconnect/index.js';

// Export preconnect module types
export type {
  ServerConfig,
  ConnectionResult,
  PermissionCheckResult,
  PreconnectOptions,
  PreconnectResult,
} from './preconnect/index.js';

// Export types (previously in @aship/types)
export * from './types/index.js';

// Export utilities (previously in @aship/utils)
export * from './utils/index.js';
