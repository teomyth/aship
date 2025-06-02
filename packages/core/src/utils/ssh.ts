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
  // 优先使用最常见的密钥类型，按使用频率排序
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
    // 1. Add standard named keys (优先级最高)
    const standardKeys = getDefaultSshKeys();
    keys.push(...standardKeys);

    // 2. 只在标准密钥不存在时才扫描其他文件，以提高性能
    if (keys.length === 0) {
      // Search for all private key files in ~/.ssh/ directory
      // Private key files typically have no extension and 600 permissions (owner read/write only)
      try {
        const files = fs.readdirSync(sshDir);
        // 限制扫描的文件数量，避免性能问题
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
            file.includes('.') // 跳过有扩展名的文件，私钥通常没有扩展名
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

    // 3. Read SSH config file for specified keys (仅在没有找到标准密钥时)
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

  // 限制返回的密钥数量，避免测试太多密钥
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
  timeout = 3000 // 减少超时时间到3秒，提高响应速度
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

    // 检查错误类型并提供更详细的信息
    const errorMessage = (error as Error).message;

    // 检查是否是密码错误
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

    // 检查是否是SSH密钥错误，并区分不同类型的错误
    if (options.privateKey) {
      // 检查密钥格式错误（库不支持的格式）
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

      // 检查密钥文件不存在或无法访问
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

      // 检查密钥被服务器拒绝（认证失败）
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

      // 其他SSH密钥相关错误
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

    // 检查是否是连接超时
    if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
      return {
        success: false,
        message: 'Connection timed out. The server may be unreachable or blocking connections.',
      };
    }

    // 检查是否是连接被拒绝
    if (errorMessage.includes('ECONNREFUSED')) {
      return {
        success: false,
        message:
          'Connection refused. The SSH service may not be running or the port may be incorrect.',
      };
    }

    // 其他错误
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

      // 跟踪不同类型的密钥错误
      const formatErrors: string[] = [];
      const notFoundErrors: string[] = [];
      const rejectedKeys: string[] = [];

      for (const keyPath of allKeys) {
        try {
          // 首先检查密钥文件是否存在
          if (!fs.existsSync(keyPath)) {
            notFoundErrors.push(keyPath);
            continue;
          }

          // 尝试连接
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
          // 根据错误类型进行分类
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

  // 如果所有密钥都尝试过了，提供详细的错误信息
  let errorDetails = '';

  // 收集最后一次尝试的密钥错误信息
  const lastMethod = authMethods[authMethods.length - 1];
  if (lastMethod === 'key') {
    // 提供一个通用消息
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

    // If all keys failed, return a failure result
    return {
      success: false,
      message: 'Failed to connect with any available SSH key',
      method: 'key',
      user: server.user,
    };
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
    sshLogger.verbose('Node.js SSH password authentication failed, trying system SSH...');
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
 * Test network connectivity to a host
 * This function tests if the host is reachable at the network level
 *
 * @param host Hostname or IP address
 * @returns Promise resolving to a boolean indicating if the host is reachable
 */
async function testNetworkConnectivity(
  host: string
): Promise<{ success: boolean; message: string }> {
  // Import from the network module
  const { testHostReachability } = await import('./network.js');

  // Special case for localhost and 127.0.0.1
  if (host === 'localhost' || host === '127.0.0.1') {
    return { success: true, message: 'Local host is always reachable' };
  }

  // Use the same test for all addresses, regardless of whether they're private or public
  return testHostReachability(host);
}

/**
 * Test SSH port connectivity
 * This function tests if the SSH port is open on the host
 *
 * @param host Hostname or IP address
 * @param port SSH port (default: 22)
 * @returns Promise resolving to a boolean indicating if the SSH port is open
 */
async function testSSHPortConnectivity(
  host: string,
  port = 22
): Promise<{ success: boolean; message: string }> {
  // Import from the network module
  const { testPortReachability } = await import('./network.js');

  // First check if the host is reachable at all
  const networkResult = await testNetworkConnectivity(host);
  if (!networkResult.success) {
    return {
      success: false,
      message: `Cannot test SSH port because host is unreachable: ${networkResult.message}`,
    };
  }

  // Test SSH port connectivity using testPortReachability
  try {
    const result = await testPortReachability(host, port);
    if (result.success) {
      return result;
    }
    // If testPortReachability fails, try a more direct approach using net module
    return new Promise(resolve => {
      import('node:net')
        .then(netModule => {
          const net = netModule.default;
          const socket = new net.Socket();

          socket.setTimeout(3000);

          socket.on('connect', () => {
            socket.end();
            resolve({ success: true, message: `SSH port ${port} is open` });
          });

          socket.on('timeout', () => {
            socket.destroy();
            resolve({
              success: false,
              message: `SSH port ${port} connection timed out`,
            });
          });

          socket.on('error', (err: Error) => {
            if (err.message.includes('ECONNREFUSED')) {
              // If connection is refused, the host is reachable but the port is closed
              resolve({ success: false, message: `SSH port ${port} is closed or blocked` });
            } else {
              // For other errors, report failure
              resolve({
                success: false,
                message: `SSH port ${port} connection error: ${err.message}`,
              });
            }
          });

          socket.connect(port, host);
        })
        .catch(_err => {
          // For errors importing the module, report failure
          resolve({
            success: false,
            message: `Failed to test SSH port ${port} connectivity`,
          });
        });
    });
  } catch (error) {
    // For errors in the test, report failure
    return {
      success: false,
      message: `Failed to test SSH port ${port} connectivity: ${error instanceof Error ? error.message : String(error)}`,
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
  // 创建SSH日志记录器
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

    // Step 1: Test network connectivity
    result.networkConnectivity = await testNetworkConnectivity(server.hostname);

    if (!result.networkConnectivity.success) {
      result.primaryIssue = 'network';
      result.detailedMessage = `Error: Cannot reach host ${server.hostname}. Please check your network connection or verify the host is online.`;
      return result;
    }

    // Step 2: Test SSH port connectivity
    result.sshPortConnectivity = await testSSHPortConnectivity(server.hostname, server.port);

    if (!result.sshPortConnectivity.success) {
      result.primaryIssue = 'port';
      result.detailedMessage = `Error: SSH port ${server.port} is not accessible. Please verify the port is correct and SSH service is running.`;
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

        // 保存认证方法信息
        if (authResult.method) {
          result.sshAuthentication.method = authResult.method;
        }
        if (authResult.keyPath) {
          result.sshAuthentication.keyPath = authResult.keyPath;
        }
      } else {
        result.primaryIssue = 'authentication';

        // 保存认证方法信息，即使认证失败
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
  testNetworkConnectivity,
  testSSHPortConnectivity,
};
