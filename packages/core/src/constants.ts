/**
 * Core application constants
 * All application-wide constants should be defined here
 */

// Application name - the only value that needs to change if app is renamed
export const APP_NAME = 'aship';

// Configuration file names derived from APP_NAME
export const CONFIG_FILE_NAME = `.${APP_NAME}rc`;
export const CONFIG_DIR_NAME = `.${APP_NAME}`;
export const CONFIG_GLOBAL_DIR = `~/.${APP_NAME}`;

// Default directory structure (all derived from APP_NAME)
export const HOSTS_FILE_NAME = 'hosts.json';
export const STATE_DIR_NAME = 'state';
export const LOGS_DIR_NAME = 'logs';
export const TEMP_DIR_NAME = 'temp';
export const CACHE_DIR_NAME = 'cache';
export const CONFIG_DIR_SUBNAME = 'config';
export const INVENTORIES_DIR_NAME = 'inventories';
export const SESSION_DIR_NAME = 'session';

// Environment variable names
export const ENV_GLOBAL_DIR = `${APP_NAME.toUpperCase()}_GLOBAL_DIR`;

// Configuration keys (used in .ashiprc file)
export const CONFIG_DIR_KEY = `${APP_NAME}_dir`;
export const CONFIG_LOG_LEVEL_KEY = 'log_level';
