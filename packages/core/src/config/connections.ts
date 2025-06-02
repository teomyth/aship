/**
 * Connection management module
 * Handles saving and loading connection information
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ensureDirectoryExists } from '../utils/fs.js';

/**
 * Connection information
 */
export interface ConnectionInfo {
  /**
   * Host
   */
  host: string;

  /**
   * Username
   */
  user: string;

  /**
   * Authentication type
   */
  authType: 'password' | 'key';

  /**
   * Authentication value (key path for key auth, password for password auth)
   */
  authValue?: string;

  /**
   * Port
   */
  port?: number;

  /**
   * Last used timestamp
   */
  lastUsed?: number;

  /**
   * Optional name for the connection
   */
  name?: string;
}

/**
 * Connections configuration
 */
export interface ConnectionsConfig {
  /**
   * List of connections
   */
  connections: ConnectionInfo[];

  /**
   * Last used connection host
   */
  lastUsed: string | null;
}

/**
 * Get the path to the connections file
 * @returns Path to the connections file
 */
export function getConnectionsFilePath(): string {
  const configDir = path.join(os.homedir(), '.aship');

  // Create config directory if it doesn't exist
  ensureDirectoryExists(configDir);

  return path.join(configDir, 'connections.json');
}

/**
 * Load connections configuration
 * @returns Connections configuration
 */
export function loadConnections(): ConnectionsConfig {
  const filePath = getConnectionsFilePath();

  if (!fs.existsSync(filePath)) {
    return { connections: [], lastUsed: null };
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Check if file is empty or contains only whitespace
    if (!content.trim()) {
      console.debug('Connections file is empty, returning default configuration');
      return { connections: [], lastUsed: null };
    }

    try {
      return JSON.parse(content) as ConnectionsConfig;
    } catch (parseError) {
      console.warn(`Failed to parse connections JSON: ${(parseError as Error).message}`);
      console.debug(`File content: ${content}`);
      // Backup corrupted file
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, content, 'utf-8');
      console.warn(`Corrupted connections file backed up to: ${backupPath}`);
      return { connections: [], lastUsed: null };
    }
  } catch (error) {
    console.warn(`Failed to load connections: ${(error as Error).message}`);
    return { connections: [], lastUsed: null };
  }
}

/**
 * Save connections configuration
 * @param config Connections configuration
 */
export function saveConnections(config: ConnectionsConfig): void {
  const filePath = getConnectionsFilePath();

  try {
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf-8');
    fs.chmodSync(filePath, 0o600);
  } catch (error) {
    console.warn(`Failed to save connections: ${(error as Error).message}`);
  }
}

/**
 * Save a connection
 * @param connection Connection information
 */
export async function saveConnection(connection: ConnectionInfo): Promise<void> {
  try {
    // Import cleanInputString function
    const { cleanInputString } = await import('../utils/string.js');

    // Clean host and user in the connection
    connection.host = cleanInputString(connection.host);
    connection.user = cleanInputString(connection.user);

    const config = loadConnections();

    // Find existing connection
    const index = config.connections.findIndex(
      c => c.host === connection.host && c.user === connection.user
    );

    if (index >= 0) {
      // Update existing connection
      config.connections[index] = {
        ...config.connections[index],
        ...connection,
        lastUsed: Date.now(),
      };
    } else {
      // Add new connection
      config.connections.push({
        ...connection,
        lastUsed: Date.now(),
      });
    }

    // Update last used connection
    config.lastUsed = connection.host;

    // Save configuration
    saveConnections(config);
  } catch (error) {
    console.warn(`Failed to save connection: ${(error as Error).message}`);
  }
}

/**
 * Get the last used connection
 * @returns Last used connection or null if not found
 */
export async function getLastConnection(): Promise<ConnectionInfo | null> {
  try {
    const config = loadConnections();

    if (!config.lastUsed || config.connections.length === 0) {
      return null;
    }

    // Find the last used connection
    const connection = config.connections.find(c => c.host === config.lastUsed);

    if (connection) {
      // Import cleanInputString function
      const { cleanInputString } = await import('../utils/string.js');

      // Clean host and user
      connection.host = cleanInputString(connection.host);
      connection.user = cleanInputString(connection.user);
    }

    return connection || null;
  } catch (error) {
    console.warn(`Failed to get last connection: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Get a connection by host and user
 * @param host Host
 * @param user User
 * @returns Connection or null if not found
 */
export async function getConnection(host: string, user: string): Promise<ConnectionInfo | null> {
  try {
    // Import cleanInputString function
    const { cleanInputString } = await import('../utils/string.js');

    // Clean host and user inputs
    const cleanHost = cleanInputString(host);
    const cleanUser = cleanInputString(user);

    const config = loadConnections();

    // Find the connection
    const connection = config.connections.find(c => c.host === cleanHost && c.user === cleanUser);

    if (connection) {
      // Clean host and user in the returned connection
      connection.host = cleanInputString(connection.host);
      connection.user = cleanInputString(connection.user);
    }

    return connection || null;
  } catch (error) {
    console.warn(`Failed to get connection: ${(error as Error).message}`);
    return null;
  }
}

/**
 * Get all connections
 * @returns List of connections
 */
export async function getAllConnections(): Promise<ConnectionInfo[]> {
  try {
    const config = loadConnections();

    // Import cleanInputString function
    const { cleanInputString } = await import('../utils/string.js');

    // Sort by last used (most recent first)
    const connections = [...config.connections].sort(
      (a, b) => (b.lastUsed || 0) - (a.lastUsed || 0)
    );

    // Clean host and user in all connections
    for (const connection of connections) {
      connection.host = cleanInputString(connection.host);
      connection.user = cleanInputString(connection.user);
    }

    return connections;
  } catch (error) {
    console.warn(`Failed to get all connections: ${(error as Error).message}`);
    return [];
  }
}

/**
 * Remove a connection
 * @param host Host
 * @param user User
 */
export async function removeConnection(host: string, user: string): Promise<void> {
  try {
    // Import cleanInputString function
    const { cleanInputString } = await import('../utils/string.js');

    // Clean host and user inputs
    const cleanHost = cleanInputString(host);
    const cleanUser = cleanInputString(user);

    const config = loadConnections();

    // Filter out the connection
    config.connections = config.connections.filter(
      c => !(c.host === cleanHost && c.user === cleanUser)
    );

    // Update last used if it was removed
    if (config.lastUsed === cleanHost) {
      config.lastUsed = config.connections.length > 0 ? config.connections[0].host : null;
    }

    // Save configuration
    saveConnections(config);
  } catch (error) {
    console.warn(`Failed to remove connection: ${(error as Error).message}`);
  }
}

/**
 * Clear all connections
 */
export function clearAllConnections(): void {
  try {
    const config: ConnectionsConfig = { connections: [], lastUsed: null };
    saveConnections(config);
  } catch (error) {
    console.warn(`Failed to clear all connections: ${(error as Error).message}`);
  }
}

/**
 * Clear connections that match a filter
 * @param filter Filter function to determine which connections to remove
 */
export async function clearConnectionsWhere(
  filter: (connection: ConnectionInfo) => boolean
): Promise<void> {
  try {
    const config = loadConnections();

    // Filter out connections that match the filter
    const removedConnections = config.connections.filter(filter);
    config.connections = config.connections.filter(c => !filter(c));

    // Update last used if it was removed
    if (config.lastUsed && removedConnections.some(c => c.host === config.lastUsed)) {
      config.lastUsed = config.connections.length > 0 ? config.connections[0].host : null;
    }

    // Save configuration
    saveConnections(config);
  } catch (error) {
    console.warn(`Failed to clear connections: ${(error as Error).message}`);
  }
}
