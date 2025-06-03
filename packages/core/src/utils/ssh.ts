/**
 * SSH utilities for Aship
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeSSH, Config as SSHConfig } from 'node-ssh';
import { sessionPasswordManager } from '../ssh/session-password-manager.js';
import type { ServerConfig } from '../types/index.js';
import logger from './logger.js';
import {
  detectNetworkError,
  detectSshError,
  diagnoseNetworkConnectivity,
  getErrorMessage,
  isRetryableError,
} from './network-error-detector.js';
import {
  detectAuthMethods,
  determineAuthStrategy,
  getAuthDescription,
} from './ssh-auth-detector.js';
import { diagnoseConnectionWithSystemSSH } from './system-ssh.js';

/**
 * Connection result type
 */
export interface ConnectionResult {
  success: boolean;
  message: string;
  method?: string;
  user?: string;
  keyPath?: string;
  /**
   * Type of SSH key error if applicable:
   * - 'format': Key format not supported by the library
   * - 'not_found': Key file not found or inaccessible
   * - 'rejected': Key is valid but rejected by the server
   * - 'unknown': Other key-related errors
   */
  keyError?: 'format' | 'not_found' | 'rejected' | 'unknown';
}

/**
 * Get default SSH key paths (standard named keys)
 * @returns Array of default SSH key paths
 */
function getDefaultSshKeys(): string[] {
  const sshDir = path.join(os.homedir(), '.ssh');
  // Prioritize the most common key types, sorted by usage frequency
  const defaultKeyNames = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];

  return defaultKeyNames
    .map(name => path.join(sshDir, name))
    .filter(keyPath => {
      try {
        return fs.existsSync(keyPath);
      } catch (_error) {
        return false;
      }
    });
}

/**
 * Get all available SSH keys including custom named keys
 * @returns Array of all SSH key paths
 */
function getAllSshKeys(): string[] {
  const sshDir = path.join(os.homedir(), '.ssh');
  const keys: string[] = [];

  try {
    // 1. Add standard named keys (highest priority)
    const standardKeys = getDefaultSshKeys();
    keys.push(...standardKeys);

    // 2. Only scan other files when standard keys don't exist, to improve performance
    if (keys.length === 0) {
      // Search for all private key files in ~/.ssh/ directory
      // Private key files typically have no extension and 600 permissions (owner read/write only)
      try {
        const files = fs.readdirSync(sshDir);
        // Limit the number of files to scan to avoid performance issues
        const maxFilesToScan = 10;
        let scannedFiles = 0;

        for (const file of files) {
          if (scannedFiles >= maxFilesToScan) {
            break;
          }

          const filePath = path.join(sshDir, file);

          // Skip obvious non-private key files
          if (
            file.endsWith('.pub') ||
            file === 'known_hosts' ||
            file === 'authorized_keys' ||
            file === 'config' ||
            file.includes('.') // Skip files with extensions, private keys usually have no extension
          ) {
            continue;
          }

          try {
            // Check file permissions, private keys typically have 600 permissions
            const stats = fs.statSync(filePath);
            const isRegularFile = stats.isFile();

            // On Windows we can't check permissions, so we just check if it's a regular file
            if (isRegularFile) {
              // Try to read the first few lines to see if it matches private key format
              try {
                const fd = fs.openSync(filePath, 'r');
                const buffer = Buffer.alloc(64);
                fs.readSync(fd, buffer, 0, 64, 0);
                fs.closeSync(fd);

                const content = buffer.toString();
                // Private key files typically start with "-----BEGIN"
                if (content.includes('-----BEGIN') && content.includes('PRIVATE KEY')) {
                  keys.push(filePath);
                }
                scannedFiles++;
              } catch (_error) {}
            }
          } catch (_error) {}
        }
      } catch (_error) {
        // Ignore directory read errors
      }
    }

    // 3. Read SSH config file for specified keys (only when no standard keys are found)
    if (keys.length === 0) {
      try {
        const configPath = path.join(sshDir, 'config');
        if (fs.existsSync(configPath)) {
          const configContent = fs.readFileSync(configPath, 'utf-8');
          const identityFileRegex = /IdentityFile\s+(.+)/g;
          let match: RegExpExecArray | null;

          match = identityFileRegex.exec(configContent);
          while (match !== null) {
            let keyPath = match[1].trim();

            // Handle quoted paths
            if (keyPath.startsWith('"') && keyPath.endsWith('"')) {
              keyPath = keyPath.slice(1, -1);
            }

            // Handle paths starting with ~
            if (keyPath.startsWith('~')) {
              keyPath = path.join(os.homedir(), keyPath.slice(1));
            }

            // Ensure path exists and is not a duplicate
            if (fs.existsSync(keyPath) && !keys.includes(keyPath)) {
              keys.push(keyPath);
            }

            match = identityFileRegex.exec(configContent);
          }
        }
      } catch (_error) {
        // Ignore config file read errors
      }
    }
  } catch (_error) {
    // Ignore all errors and return whatever keys we found
  }

  // Limit the number of returned keys to avoid testing too many keys
  return keys.slice(0, 5);
}

/**
 * Test SSH connection with specific options
 * @param options Connection options
 * @param timeout Connection timeout in milliseconds
 * @returns Connection result
 */
async function testConnectionWithOptions(
  options: SSHConfig,
  timeout = 3000 // Reduce timeout to 3 seconds to improve response speed
): Promise<ConnectionResult> {
  const ssh = new NodeSSH();

  // Create a logger for SSH operations
  const sshLogger = logger.createChild('ssh');

  try {
    // Add more detailed logging with SSH prefix
    const authMethod = options.password
      ? 'password'
      : options.privateKey
        ? 'key'
        : options.agent
          ? 'agent'
          : 'unknown';
    sshLogger.verbose(
      `Connecting to ${options.username}@${options.host}:${options.port} using ${authMethod} authentication...`
    );

    // Try to connect with a timeout
    await Promise.race([
      ssh.connect(options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), timeout)
      ),
    ]);

    // Run a simple command to verify connection
    const result = await ssh.execCommand('echo "Connection successful"');

    // Disconnect
    try {
      ssh.dispose();
    } catch (_error) {
      // Ignore errors during disconnect
    }

    // Determine authentication method used
    let method = 'unknown';
    if (options.privateKey) {
      method = 'key';
    } else if (options.password) {
      method = 'password';
    } else if (options.agent) {
      method = 'agent';
    }

    sshLogger.verbose(`Connection successful using ${method} authentication.`);

    return {
      success: true,
      message: result.stdout || 'Connection successful',
      method,
      user: options.username,
      keyPath: options.privateKey,
    };
  } catch (error) {
    // Ensure connection is closed
    try {
      ssh.dispose();
    } catch (_error) {
      // Ignore errors during disconnect
    }

    // Add more detailed error logging
    sshLogger.verbose(`Connection failed: ${(error as Error).message}`);

    // Check error type and provide more detailed information
    const errorMessage = (error as Error).message;

    // Check if it's a password error
    if (
      options.password &&
      (errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('All configured authentication methods failed'))
    ) {
      sshLogger.verbose('Password authentication failed. The password may be incorrect.');
      return {
        success: false,
        message: 'Password authentication failed. The password may be incorrect.',
        method: 'password',
        user: options.username,
      };
    }

    // Check if it's an SSH key error and distinguish different types of errors
    if (options.privateKey) {
      // Check for key format errors (formats not supported by the library)
      if (
        errorMessage.includes('key format') ||
        errorMessage.includes('Cannot parse') ||
        errorMessage.includes('Unsupported key format')
      ) {
        sshLogger.verbose(`SSH key format error: ${errorMessage}`);
        return {
          success: false,
          message: `SSH key format not supported: ${errorMessage}`,
          method: 'key',
          user: options.username,
          keyPath: options.privateKey,
          keyError: 'format',
        };
      }

      // Check if key file doesn't exist or is inaccessible
      if (
        errorMessage.includes('no such file') ||
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('cannot be found')
      ) {
        sshLogger.verbose(`SSH key file not found: ${options.privateKey}`);
        return {
          success: false,
          message: `SSH key file not found: ${options.privateKey}`,
          method: 'key',
          user: options.username,
          keyPath: options.privateKey,
          keyError: 'not_found',
        };
      }

      // Check if key is rejected by server (authentication failed)
      if (
        errorMessage.includes('Authentication failed') ||
        errorMessage.includes('Permission denied') ||
        errorMessage.includes('All configured authentication methods failed')
      ) {
        sshLogger.verbose('SSH key rejected by server. The key may be valid but not authorized.');
        return {
          success: false,
          message: 'SSH key rejected by server. The key may be valid but not authorized.',
          method: 'key',
          user: options.username,
          keyPath: options.privateKey,
          keyError: 'rejected',
        };
      }

      // Other SSH key related errors
      sshLogger.verbose(`SSH key authentication failed: ${errorMessage}`);
      return {
        success: false,
        message: `SSH key authentication failed: ${errorMessage}`,
        method: 'key',
        user: options.username,
        keyPath: options.privateKey,
        keyError: 'unknown',
      };
    }

    // Use the new network error detector for better error categorization
    const networkError = detectSshError(error);

    // For network-related errors, provide specific guidance
    if (networkError.type !== 'unknown') {
      return {
        success: false,
        message: getErrorMessage(error, 'SSH connection'),
      };
    }

    // Other errors
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

/**
 * Automatically try to connect to a server using various methods
 * @param host Server hostname or IP
 * @param options Connection options
 * @returns Connection result
 */
async function autoConnect(
  host: string,
  options: {
    port?: number;
    username?: string;
    preferredAuthMethods?: ('agent' | 'key' | 'password')[];
  } = {}
): Promise<ConnectionResult> {
  const port = options.port || 22;

  // Use provided username or try to get current username as fallback
  const username = options.username || os.userInfo().username;

  // Default auth methods order if not specified
  const authMethods = options.preferredAuthMethods || ['agent', 'key'];

  // Try authentication methods in the specified order
  for (const method of authMethods) {
    // Try agent authentication
    if (method === 'agent' && process.env.SSH_AUTH_SOCK) {
      const agentResult = await testConnectionWithOptions({
        host,
        port,
        username,
        agent: process.env.SSH_AUTH_SOCK,
      } as SSHConfig);

      if (agentResult.success) {
        return {
          ...agentResult,
          message: `Successfully connected to ${host}:${port} as ${username} using SSH agent`,
          method: 'agent',
          user: username,
        };
      }
    }

    // Try key authentication
    if (method === 'key') {
      // Get all available SSH keys (including custom named keys)
      const allKeys = getAllSshKeys();

      // Track different types of key errors
      const formatErrors: string[] = [];
      const notFoundErrors: string[] = [];
      const rejectedKeys: string[] = [];

      for (const keyPath of allKeys) {
        try {
          // First check if the key file exists
          if (!fs.existsSync(keyPath)) {
            notFoundErrors.push(keyPath);
            continue;
          }

          // Try to connect
          const keyResult = await testConnectionWithOptions({
            host,
            port,
            username,
            privateKey: keyPath,
          } as SSHConfig);

          if (keyResult.success) {
            return {
              ...keyResult,
              message: `Successfully connected to ${host}:${port} as ${username} using key: ${keyPath}`,
              method: 'key',
              user: username,
              keyPath,
            };
          }
          // Classify by error type
          if (keyResult.keyError === 'format') {
            formatErrors.push(keyPath);
            console.log(`Skipping key ${keyPath} due to format error: ${keyResult.message}`);
          } else if (keyResult.keyError === 'not_found') {
            notFoundErrors.push(keyPath);
            console.log(`Skipping key ${keyPath}: file not found`);
          } else if (keyResult.keyError === 'rejected') {
            rejectedKeys.push(keyPath);
            console.log(`Key ${keyPath} was rejected by the server`);
          } else {
            console.log(`Failed to connect with key ${keyPath}: ${keyResult.message}`);
          }
        } catch (error) {
          console.log(
            `Error trying key ${keyPath}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    // Password authentication requires user input, so we don't try it automatically
    // It's included in the auth methods for completeness
  }

  // If all keys have been tried, provide detailed error information
  let errorDetails = '';

  // Collect error information from the last key attempt
  const lastMethod = authMethods[authMethods.length - 1];
  if (lastMethod === 'key') {
    // Provide a general message
    errorDetails = 'All SSH keys were tried but none worked. ';
  }

  // If all automatic methods fail, return failure with detailed error message
  return {
    success: false,
    message: `Could not automatically connect to ${host}:${port} as ${username}. ${errorDetails}Please provide credentials.`,
  };
}

/**
 * Test SSH connection to a server
 * @param server Server configuration
 * @returns Connection result
 */
async function testConnection(server: ServerConfig): Promise<ConnectionResult> {
  // Create a logger for SSH operations
  const sshLogger = logger.createChild('ssh');

  // If key authentication is specified but no key value is provided, try all available keys
  if (!server.identity_file) {
    sshLogger.verbose('No specific SSH key provided, trying all available keys...');

    // Get all available SSH keys
    const allKeys = getAllSshKeys();
    sshLogger.verbose(`Found ${allKeys.length} SSH keys to try`);

    // Try each key until one works
    for (const keyPath of allKeys) {
      sshLogger.verbose(`Trying SSH key: ${keyPath}`);

      const connectionOptions: SSHConfig = {
        host: server.hostname,
        port: server.port,
        username: server.user,
        privateKey: keyPath,
      };

      const result = await testConnectionWithOptions(connectionOptions);

      if (result.success) {
        sshLogger.verbose(`Successfully connected using key: ${keyPath}`);
        return {
          ...result,
          keyPath,
        };
      }
    }

    // If all keys failed, continue to try password authentication
    sshLogger.verbose('All SSH keys failed, continuing to password authentication...');
  }

  // Standard authentication with specified credentials
  const connectionOptions: SSHConfig = {
    host: server.hostname,
    port: server.port,
    username: server.user,
  };

  // Set authentication method
  if (server.identity_file) {
    connectionOptions.privateKey = server.identity_file;
    return testConnectionWithOptions(connectionOptions);
  }

  // Try to get password from session manager
  const password = sessionPasswordManager.getPassword(server.hostname, server.user);
  if (password) {
    connectionOptions.password = password;

    // For password authentication, try Node.js SSH first, then fallback to system SSH
    const nodeResult = await testConnectionWithOptions(connectionOptions);

    if (nodeResult.success) {
      return nodeResult;
    }

    // If Node.js SSH fails with password, try system SSH as fallback
    try {
      const { testConnectionWithPassword } = await import('./system-ssh.js');
      const systemResult = await testConnectionWithPassword(server, password, {
        suppressDebugOutput: false,
      });

      if (systemResult.success) {
        return {
          success: true,
          message: systemResult.message,
          method: 'password',
          user: server.user,
        };
      }
    } catch (systemError) {
      sshLogger.verbose(`System SSH also failed: ${(systemError as Error).message}`);
    }

    // Return the original Node.js result if system SSH also fails
    return nodeResult;
  }

  // No specific authentication method - let SSH handle default authentication
  connectionOptions.agent = process.env.SSH_AUTH_SOCK;
  return testConnectionWithOptions(connectionOptions);
}

/**
 * Try to connect to a server with retry support
 * This function will attempt to connect to a server and handle network errors
 * It will provide detailed error messages and allow for retries
 *
 * @param server Server configuration
 * @param options Options for connection attempt
 * @returns Connection result with additional retry information
 */
export interface ConnectionAttemptOptions {
  maxAttempts?: number;
  onRetry?: (attempt: number, maxAttempts: number, error: string) => Promise<boolean>;
  onNetworkError?: (error: string) => void;
  onAuthError?: (error: string) => void;
}

export interface ConnectionAttemptResult extends ConnectionResult {
  isNetworkError?: boolean;
  isAuthError?: boolean;
}

/**
 * Try to connect to a server with retry support using system SSH
 * This function will attempt to connect to a server using the system SSH command
 * It will provide detailed error messages and allow for retries
 *
 * @param server Server configuration
 * @param options Options for connection attempt
 * @returns Connection result with additional retry information
 */
export async function tryConnectionWithSystemSSH(
  server: ServerConfig,
  options: ConnectionAttemptOptions = {}
): Promise<ConnectionAttemptResult> {
  const maxAttempts = options.maxAttempts || 3;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    try {
      console.log(
        `Attempting to connect to ${server.user}@${server.hostname} (Attempt ${attempt}/${maxAttempts})...`
      );

      // Run diagnostics to check network, port, and authentication
      const diagnostics = await diagnoseConnection(server, { suppressDebugOutput: true });

      if (diagnostics.overallSuccess) {
        // Connection successful
        return {
          success: true,
          message: diagnostics.detailedMessage,
          method: diagnostics.sshAuthentication.method || 'system-ssh',
          user: server.user,
          keyPath: diagnostics.sshAuthentication.keyPath,
          isNetworkError: false,
          isAuthError: false,
        };
      }
      // Connection failed, determine the type of error
      const isNetworkError = diagnostics.primaryIssue === 'network';
      const isPortError = diagnostics.primaryIssue === 'port';
      const isAuthError = diagnostics.primaryIssue === 'authentication';

      // Call appropriate error handler
      if (isNetworkError && options.onNetworkError) {
        options.onNetworkError(diagnostics.detailedMessage);
      } else if (isPortError && options.onNetworkError) {
        options.onNetworkError(diagnostics.detailedMessage);
      } else if (isAuthError && options.onAuthError) {
        options.onAuthError(diagnostics.detailedMessage);
      }

      // If this is not the last attempt, ask if user wants to retry
      if (attempt < maxAttempts && options.onRetry) {
        const shouldRetry = await options.onRetry(
          attempt,
          maxAttempts,
          diagnostics.detailedMessage
        );

        if (!shouldRetry) {
          // User chose not to retry, return the current result
          return {
            success: false,
            message: diagnostics.detailedMessage,
            isNetworkError: isNetworkError || isPortError,
            isAuthError,
          };
        }

        // User chose to retry, continue the loop
        continue;
      }

      // Return the result with error type information
      return {
        success: false,
        message: diagnostics.detailedMessage,
        isNetworkError: isNetworkError || isPortError,
        isAuthError,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Default to network error handler for unexpected errors
      if (options.onNetworkError) {
        options.onNetworkError(errorMessage);
      }

      // If this is not the last attempt, ask if user wants to retry
      if (attempt < maxAttempts && options.onRetry) {
        const shouldRetry = await options.onRetry(attempt, maxAttempts, errorMessage);

        if (!shouldRetry) {
          // User chose not to retry, return error result
          return {
            success: false,
            message: errorMessage,
            isNetworkError: true,
            isAuthError: false,
          };
        }

        // User chose to retry, continue the loop
        continue;
      }

      // Return error result
      return {
        success: false,
        message: errorMessage,
        isNetworkError: true,
        isAuthError: false,
      };
    }
  }

  // If we get here, we've exhausted all attempts
  return {
    success: false,
    message: `Connection failed after ${maxAttempts} attempts`,
    isNetworkError: false,
    isAuthError: false,
  };
}

async function tryConnection(
  server: ServerConfig,
  options: ConnectionAttemptOptions = {}
): Promise<ConnectionAttemptResult> {
  // Use system SSH if available
  try {
    return await tryConnectionWithSystemSSH(server, options);
  } catch (error) {
    console.log('Error using system SSH, falling back to Node.js implementation:', error);

    // Fall back to Node.js implementation
    const maxAttempts = options.maxAttempts || 3;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;

      try {
        console.log(`Attempting to connect to ${server.user}@${server.hostname}...`);

        // Attempt to connect
        const result = await testConnection(server);

        if (result.success) {
          return {
            ...result,
            isNetworkError: false,
            isAuthError: false,
          };
        }
        // Check if it's a network error or authentication error
        const isNetworkError =
          result.message.includes('EHOSTUNREACH') ||
          result.message.includes('ECONNREFUSED') ||
          result.message.includes('ETIMEDOUT') ||
          result.message.includes('connect') ||
          result.message.includes('timeout');

        const isAuthError =
          result.message.includes('Authentication failed') ||
          result.message.includes('authentication') ||
          result.message.includes('Permission denied') ||
          result.message.includes('privateKey') ||
          result.message.includes('key format') ||
          result.message.includes('Cannot parse');

        // Call appropriate error handler
        if (isNetworkError && options.onNetworkError) {
          options.onNetworkError(result.message);
        } else if (isAuthError && options.onAuthError) {
          options.onAuthError(result.message);
        }

        // If this is not the last attempt, ask if user wants to retry
        if (attempt < maxAttempts && options.onRetry) {
          const shouldRetry = await options.onRetry(attempt, maxAttempts, result.message);

          if (!shouldRetry) {
            // User chose not to retry, return the current result
            return {
              ...result,
              isNetworkError,
              isAuthError,
            };
          }

          // User chose to retry, continue the loop
          continue;
        }

        // Return the result with error type information
        return {
          ...result,
          isNetworkError,
          isAuthError,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Check if it's a network error or authentication error
        const isNetworkError =
          errorMessage.includes('timeout') ||
          errorMessage.includes('EHOSTUNREACH') ||
          errorMessage.includes('ECONNREFUSED') ||
          errorMessage.includes('ETIMEDOUT') ||
          errorMessage.includes('connect');

        const isAuthError =
          errorMessage.includes('Authentication failed') ||
          errorMessage.includes('authentication') ||
          errorMessage.includes('Permission denied') ||
          errorMessage.includes('privateKey') ||
          errorMessage.includes('key format') ||
          errorMessage.includes('Cannot parse');

        // Call appropriate error handler based on error type
        if (isNetworkError && options.onNetworkError) {
          options.onNetworkError(errorMessage);
        } else if (isAuthError && options.onAuthError) {
          options.onAuthError(errorMessage);
        } else if (options.onNetworkError) {
          // Default to network error handler for unexpected errors
          options.onNetworkError(errorMessage);
        }

        // If this is not the last attempt, ask if user wants to retry
        if (attempt < maxAttempts && options.onRetry) {
          const shouldRetry = await options.onRetry(attempt, maxAttempts, errorMessage);

          if (!shouldRetry) {
            // User chose not to retry, return error result
            return {
              success: false,
              message: errorMessage,
              isNetworkError: isNetworkError,
              isAuthError: isAuthError,
            };
          }

          // User chose to retry, continue the loop
          continue;
        }

        // Return error result
        return {
          success: false,
          message: errorMessage,
          isNetworkError: isNetworkError,
          isAuthError: isAuthError,
        };
      }
    }

    // If we get here, we've exhausted all attempts
    return {
      success: false,
      message: `Connection failed after ${maxAttempts} attempts`,
      isNetworkError: false,
      isAuthError: false,
    };
  }
}

/**
 * Comprehensive connection test
 * This function performs a series of tests to diagnose connection issues:
 * 1. Network connectivity test
 * 2. SSH port connectivity test
 * 3. SSH authentication test
 *
 * @param server Server configuration
 * @returns Detailed connection test results
 */
export interface ConnectionDiagnostics {
  networkConnectivity: {
    success: boolean;
    message: string;
  };
  sshPortConnectivity: {
    success: boolean;
    message: string;
  };
  sshAuthentication: {
    success: boolean;
    message: string;
    method?: string;
    keyPath?: string;
  };
  overallSuccess: boolean;
  primaryIssue: 'network' | 'port' | 'authentication' | 'none';
  detailedMessage: string;
}

async function diagnoseConnection(
  server: ServerConfig,
  options: { suppressDebugOutput?: boolean } = {}
): Promise<ConnectionDiagnostics> {
  // Create SSH logger
  const sshLogger = logger.createChild('ssh');

  // Try using system SSH command first
  try {
    if (!options.suppressDebugOutput) {
      sshLogger.verbose('Using system SSH for connection diagnostics...');
    }
    const systemResult = await diagnoseConnectionWithSystemSSH(server, {
      suppressDebugOutput: options.suppressDebugOutput,
    });
    return systemResult;
  } catch (error) {
    sshLogger.verbose(
      'System SSH diagnostics failed, falling back to Node.js implementation:',
      error
    );

    // Fall back to Node.js implementation
    // Initialize result object
    const result: ConnectionDiagnostics = {
      networkConnectivity: {
        success: false,
        message: 'Not tested',
      },
      sshPortConnectivity: {
        success: false,
        message: 'Not tested',
      },
      sshAuthentication: {
        success: false,
        message: 'Not tested',
      },
      overallSuccess: false,
      primaryIssue: 'none',
      detailedMessage: '',
    };

    // Use the new comprehensive network diagnostics
    const networkDiagnostics = await diagnoseNetworkConnectivity(
      server.hostname,
      server.port,
      5000
    );

    result.networkConnectivity = {
      success: networkDiagnostics.dns.success,
      message: networkDiagnostics.dns.error?.message || 'DNS resolution successful',
    };

    result.sshPortConnectivity = {
      success: networkDiagnostics.port.success,
      message: networkDiagnostics.port.error?.message || 'Port connectivity successful',
    };

    if (!networkDiagnostics.overall.success) {
      // Map the network diagnostic issue types to our interface types
      switch (networkDiagnostics.overall.primaryIssue) {
        case 'dns':
          result.primaryIssue = 'network';
          break;
        case 'port':
          result.primaryIssue = 'port';
          break;
        default:
          result.primaryIssue = 'network';
          break;
      }

      // Provide detailed error message with suggestions
      const primaryError =
        networkDiagnostics.overall.primaryIssue === 'dns'
          ? networkDiagnostics.dns.error
          : networkDiagnostics.port.error;

      if (primaryError) {
        result.detailedMessage = getErrorMessage(
          { code: primaryError.code, message: primaryError.message },
          'Connection'
        );
      } else {
        result.detailedMessage = `Error: ${networkDiagnostics.overall.primaryIssue} connectivity failed`;
      }

      return result;
    }

    // Step 3: Test SSH authentication
    try {
      const authResult = await testConnection(server);
      result.sshAuthentication = authResult;

      if (authResult.success) {
        result.overallSuccess = true;
        result.primaryIssue = 'none';
        result.detailedMessage = 'Connection successful!';

        // Save authentication method information
        if (authResult.method) {
          result.sshAuthentication.method = authResult.method;
        }
        if (authResult.keyPath) {
          result.sshAuthentication.keyPath = authResult.keyPath;
        }
      } else {
        result.primaryIssue = 'authentication';

        // Save authentication method information, even if authentication failed
        if (authResult.method) {
          result.sshAuthentication.method = authResult.method;
        }
        if (authResult.keyPath) {
          result.sshAuthentication.keyPath = authResult.keyPath;
        }

        // Determine the specific authentication issue
        if (
          authResult.message.includes('SSH key authentication failed') ||
          authResult.message.includes('key format') ||
          authResult.message.includes('privateKey')
        ) {
          result.detailedMessage =
            'Error: SSH key authentication failed. The key may be invalid or not accepted by the server.';
        } else if (
          authResult.message.includes('Password authentication failed') ||
          authResult.message.includes('Authentication failed') ||
          authResult.message.includes('Permission denied')
        ) {
          result.detailedMessage =
            'Error: Authentication failed. The username or password may be incorrect.';
        } else if (authResult.message.includes('Connection timed out')) {
          result.detailedMessage =
            'Error: Connection timed out. The server may be unreachable or blocking connections.';
        } else if (authResult.message.includes('Connection refused')) {
          result.detailedMessage =
            'Error: Connection refused. The SSH service may not be running or the port may be incorrect.';
        } else {
          result.detailedMessage = `Error: SSH authentication issue: ${authResult.message}`;
        }
      }
    } catch (error) {
      result.primaryIssue = 'authentication';
      result.sshAuthentication.message = error instanceof Error ? error.message : String(error);
      result.detailedMessage = `Error: SSH authentication error: ${result.sshAuthentication.message}`;
    }

    return result;
  }
}

export {
  testConnection,
  autoConnect,
  getDefaultSshKeys,
  getAllSshKeys,
  SSHConfig,
  NodeSSH,
  tryConnection,
  diagnoseConnection,
  // Export new network diagnostic functions
  detectNetworkError,
  detectSshError,
  diagnoseNetworkConnectivity,
  isRetryableError,
  getErrorMessage,
  // Export SSH auth detection functions
  detectAuthMethods,
  determineAuthStrategy,
  getAuthDescription,
};
