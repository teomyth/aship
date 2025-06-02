/**
 * Schema definitions for Aship configuration files
 */

// Project configuration schemas (aship.yml)
export {
  ProjectConfigSchema,
  TagsConfigSchema,
  validateProjectConfig,
  createDefaultProjectConfig,
  createMinimalProjectConfig,
  normalizeTagsConfig,
  type ProjectConfig,
  type TagsConfig,
  type NormalizedTagsConfig,
} from './project-config.js';

// Server configuration schemas (.aship/servers.yml)
export {
  ServerConfigSchema,
  ServersConfigSchema,
  validateServersConfig,
  createDefaultServersConfig,
  type ServerConfig,
  type ServersConfig,
} from './servers-config.js';

// Host configuration schemas (hosts.yml)
export {
  HostConfigSchema,
  HostsConfigSchema,
  HostUsageSchema,
  HostUsageHistorySchema,
  RecentConnectionSchema,
  validateHostsConfig,
  validateHostUsageHistory,
  validateRecentConnection,
  createDefaultHostsConfig,
  createDefaultHostUsageHistory,
  type HostConfig,
  type HostsConfig,
  type HostUsage,
  type HostUsageHistory,
  type RecentConnection,
  type HostChoice,
} from './host-config.js';

// Variable definition schemas
export {
  VariableDefinitionSchema,
  createVariableValueSchema,
  validateVariableValue,
  type VariableDefinition,
} from './variables.js';
