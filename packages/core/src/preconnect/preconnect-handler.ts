/**
 * Preconnect Handler Module
 *
 * This module provides a high-level API for handling pre-connection and pre-processing
 * steps that are common across different commands. It orchestrates the following processes:
 *
 * 1. Server connection - Establishing an SSH connection to the target server
 * 2. Permission verification - Checking if the user has sufficient permissions
 * 3. Connection information storage - Saving successful connection details
 *
 * The module is designed to be flexible, allowing callers to skip certain steps
 * or customize the behavior through options.
 */

import chalk from 'chalk';
import { verifyUserPermissions } from './permission-check.js';
import { connectToServer, saveConnectionInfo } from './server-connect.js';
import type { PreconnectOptions, PreconnectResult, PreconnectServerConfig } from './types.js';

/**
 * Handle preconnect process for a server
 *
 * This function orchestrates the server connection and permission verification process.
 * It can be configured to skip certain steps or customize behavior through options.
 *
 * The function follows these steps:
 * 1. Connect to the server (unless skipConnectionTest is true)
 * 2. Save successful connection information
 * 3. Verify user permissions (unless skipPermissionCheck is true)
 * 4. Return a result object with connection status and server configuration
 *
 * @param host - Server hostname or IP address
 * @param port - Server SSH port (defaults to 22)
 * @param username - SSH username to connect with
 * @param options - Configuration options for the preconnect process
 *   - password: SSH password (optional)
 *   - privateKey: Path to SSH private key file (optional)
 *   - skipConnectionTest: Skip the connection test step (default: false)
 *   - skipPermissionCheck: Skip the permission verification step (default: false)
 *   - maxRetryAttempts: Maximum number of connection retry attempts (default: 3)
 *   - exitOnFailure: Exit process on connection failure (default: false)
 *   - exitOnPermissionFailure: Exit process on permission check failure (default: false)
 *
 * @returns A PreconnectResult object containing:
 *   - success: Boolean indicating if the preconnect process was successful
 *   - serverConfig: Server configuration object (if successful)
 *   - errorMessage: Error message (if unsuccessful)
 *   - permissionResult: Results of permission verification (if performed)
 */
export async function handlePreconnect(
  host: string,
  port: number,
  username: string,
  options: PreconnectOptions & {
    password?: string;
    privateKey?: string;
  } = {}
): Promise<PreconnectResult> {
  try {
    // If connection test is skipped, just create a server config without connecting
    if (options.skipConnectionTest) {
      const serverConfig: PreconnectServerConfig = {
        name: `temp-${host.replace(/[^a-zA-Z0-9]/g, '-')}`,
        hostname: host,
        port,
        user: username,
        identity_file: options.password ? undefined : options.privateKey || '~/.ssh/id_rsa',
      };

      return {
        success: true,
        serverConfig,
      };
    }

    // Step 1: Connect to the server
    const connectionResult = await connectToServer(host, port, username, {
      password: options.password,
      privateKey: options.privateKey,
      maxRetries: options.maxRetryAttempts || 3,
      exitOnFailure: options.exitOnFailure,
    });

    // Handle connection failure
    if (!connectionResult.success) {
      return {
        success: false,
        errorMessage: connectionResult.errorMessage || 'Failed to connect to the server',
      };
    }

    // Save successful connection information (unless skipped)
    if (connectionResult.serverConfig && !options.skipSaveConnection) {
      // Check if this is a connection from a saved host
      const isSavedHost =
        connectionResult.serverConfig.name &&
        !connectionResult.serverConfig.name.startsWith('temp-');

      // Only save if it's not already a saved host
      if (!isSavedHost) {
        await saveConnectionInfo(connectionResult.serverConfig);
      }
    }

    // Step 2: Check user permissions (if not skipped)
    if (!options.skipPermissionCheck && connectionResult.serverConfig) {
      const permissionResult = await verifyUserPermissions(
        connectionResult.serverConfig.hostname,
        connectionResult.serverConfig.port,
        connectionResult.serverConfig.user,
        undefined, // password - handled by session manager
        connectionResult.serverConfig.identity_file,
        { exitOnFailure: options.exitOnPermissionFailure }
      );

      // Update server config with the authentication information from permission check
      if (permissionResult.success && permissionResult.authType && permissionResult.authValue) {
        console.log(
          chalk.green(`Using ${permissionResult.authType} authentication from permission check.`)
        );

        if (connectionResult.serverConfig) {
          if (permissionResult.authType === 'key' && permissionResult.authValue) {
            connectionResult.serverConfig.identity_file = permissionResult.authValue;
          }
          // Password authentication is handled by session manager
        }
      }

      // Return result with both server config and permission result
      return {
        success: true,
        serverConfig: connectionResult.serverConfig,
        permissionResult: {
          ...permissionResult,
          permissionLevel: permissionResult.permissionLevel || 'none',
          hasError: permissionResult.hasError || false,
        },
      };
    }

    // Return result with server config only (no permission check)
    return {
      success: true,
      serverConfig: connectionResult.serverConfig,
    };
  } catch (error) {
    // Handle any unexpected errors
    return {
      success: false,
      errorMessage: `Preconnect process failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Handle preconnect process for multiple servers
 *
 * This function processes multiple servers sequentially, applying the preconnect
 * process to each one. It's useful for batch operations that need to connect to
 * multiple servers.
 *
 * @param servers - Array of server configurations to process
 *   - host: Server hostname or IP address
 *   - port: Server SSH port (defaults to 22)
 *   - username: SSH username to connect with
 *   - password: SSH password (optional)
 *   - privateKey: Path to SSH private key file (optional)
 *
 * @param options - Global preconnect options that apply to all servers
 *   These options can be overridden by server-specific options
 *
 * @returns Array of preconnect results, one for each server, with the host property added
 *   Each result contains:
 *   - host: The server hostname (added for identification)
 *   - success: Boolean indicating if the preconnect process was successful
 *   - serverConfig: Server configuration object (if successful)
 *   - errorMessage: Error message (if unsuccessful)
 *   - permissionResult: Results of permission verification (if performed)
 */
export async function handleMultiplePreconnect(
  servers: Array<{
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
  }>,
  options: PreconnectOptions = {}
): Promise<Array<PreconnectResult & { host: string }>> {
  const results: Array<PreconnectResult & { host: string }> = [];

  // Process each server sequentially
  for (const server of servers) {
    console.log(chalk.blue(`Processing server: ${server.host}`));

    // Apply the preconnect process to this server
    const result = await handlePreconnect(server.host, server.port || 22, server.username, {
      ...options,
      password: server.password,
      privateKey: server.privateKey,
    });

    // Add the host to the result for identification
    const resultWithHost = {
      ...result,
      host: server.host,
    };

    // Add to results array
    results.push(resultWithHost);

    // Log the result
    if (result.success) {
      console.log(chalk.green(`✓ Successfully processed server: ${server.host}`));
    } else {
      console.log(chalk.red(`✗ Failed to process server: ${server.host}`));
      if (result.errorMessage) {
        console.log(chalk.red(`  Error: ${result.errorMessage}`));
      }
    }
  }

  // Return all results
  return results;
}
