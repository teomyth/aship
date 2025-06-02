/**
 * System SSH utility functions
 * This module provides functions to execute SSH commands using the system's SSH client
 */

import { exec } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { sessionPasswordManager } from '../ssh/session-password-manager.js';
import type { ServerConfig } from '../types/index.js';
import { logger } from './logger.js';

// Simple expandTilde function
function expandTilde(filePath: string): string {
  if (filePath.startsWith('~')) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

const execPromise = promisify(exec);

/**
 * Quick check if server supports password authentication
 * @param server Server configuration
 * @param options Options
 * @returns Check results
 */
async function quickPasswordAuthCheck(
  server: ServerConfig,
  _options: { suppressDebugOutput?: boolean } = {}
): Promise<{ passwordAuthAvailable: boolean; message: string }> {
  // Use a very short timeout for quick detection
  const quickTestCommand = `timeout 1 ssh -o BatchMode=no -o ConnectTimeout=1 -o PasswordAuthentication=yes -o PubkeyAuthentication=no -o StrictHostKeyChecking=no -p ${server.port} ${server.user}@${server.hostname} "echo test" 2>&1 || true`;

  try {
    const result = await execPromise(quickTestCommand);
    const output = result.stdout + result.stderr;

    // Check if password prompt appears
    if (
      output.includes('password:') ||
      output.includes('Password:') ||
      output.includes('password for')
    ) {
      return { passwordAuthAvailable: true, message: 'Password authentication available' };
    }

    // Check if password authentication is explicitly disabled
    if (output.includes('Permission denied (publickey)') && !output.includes('password')) {
      return { passwordAuthAvailable: false, message: 'Password authentication disabled' };
    }

    // Default assume password authentication is available (conservative policy)
    return { passwordAuthAvailable: true, message: 'Password authentication likely available' };
  } catch (_error) {
    // If quick detection fails, assume password authentication is available
    return {
      passwordAuthAvailable: true,
      message: 'Quick check failed, assuming password auth available',
    };
  }
}

/**
 * Test SSH connection using system SSH command
 * This function uses the system's SSH client to test connection to a server
 *
 * @param server Server configuration
 * @param options Options for connection test
 * @returns Promise resolving to a result object with success status and detailed message
 */
export async function testConnectionWithSystemSSH(
  server: ServerConfig,
  options: { suppressDebugOutput?: boolean } = {}
): Promise<{
  success: boolean;
  message: string;
  method?: string;
  user?: string;
  keyPath?: string;
}> {
  // Import getAllSshKeys function
  const { getAllSshKeys } = await import('./ssh.js');

  // Determine whether to use verbose mode (-v) based on suppressDebugOutput option
  const verboseFlag = options.suppressDebugOutput ? '' : '-v';

  // Get all available SSH keys
  const allKeys = getAllSshKeys();

  if (!options.suppressDebugOutput && allKeys.length > 0) {
    logger.verbose(`Found ${allKeys.length} SSH key(s) to test:`);
    allKeys.forEach((key, index) => {
      logger.verbose(`  ${index + 1}. ${key}`);
    });
  }

  // Try each SSH key individually
  for (let i = 0; i < allKeys.length; i++) {
    const keyPath = allKeys[i];
    if (!options.suppressDebugOutput) {
      logger.verbose(`Testing SSH key ${i + 1}/${allKeys.length}: ${keyPath}`);
    }

    try {
      const keyResult = await testConnectionWithKey(server, keyPath, options);

      if (keyResult.success) {
        if (!options.suppressDebugOutput) {
          logger.verbose('SSH key authentication successful!');
        }
        return {
          success: true,
          message: `Connection successful with SSH key: ${keyPath}`,
          method: 'key',
          user: server.user,
          keyPath: keyPath,
        };
      }
      if (!options.suppressDebugOutput) {
        logger.verbose(`Failed: ${keyResult.message}`);
      }

      // If key file does not exist, skip subsequent tests
      if (keyResult.message.includes('SSH key file not found')) {
        if (!options.suppressDebugOutput) {
          logger.verbose('SSH key file not found, skipping to password authentication check...');
        }
        break; // Exit the key testing loop
      }

      // Check if server only supports password authentication (does not support public key authentication)
      if (
        keyResult.message.includes(
          'Server only supports password authentication, no publickey support'
        )
      ) {
        if (!options.suppressDebugOutput) {
          logger.verbose('Server only supports password authentication, stopping all key tests...');
        }
        // Return result indicating password authentication is required
        return {
          success: false,
          message: 'Server only supports password authentication',
          method: 'password-required',
          user: server.user,
        };
      }

      // If any key fails and error message indicates authentication was rejected, quickly check password authentication
      if (keyResult.message.includes('Authentication failed with key')) {
        if (!options.suppressDebugOutput) {
          logger.verbose(
            'SSH key authentication failed, quickly checking password authentication...'
          );
        }

        // Quick check if password authentication is available
        const quickCheck = await quickPasswordAuthCheck(server);
        if (quickCheck.passwordAuthAvailable) {
          if (!options.suppressDebugOutput) {
            logger.verbose('Password authentication detected, stopping key tests...');
          }
          // Return result indicating password authentication is available, no further testing needed
          return {
            success: false,
            message: 'SSH key authentication failed, server accepts password authentication',
            method: 'password-possible',
            user: server.user,
          };
        }
      }
    } catch (error) {
      if (!options.suppressDebugOutput) {
        logger.verbose(`SSH key failed: ${keyPath} - ${(error as Error).message}`);
      }
    }
  }

  // If no keys worked, try general SSH connection to detect password authentication
  const sshCommandBatchMode = `ssh ${verboseFlag} -o BatchMode=yes -o ConnectTimeout=2 -o ServerAliveInterval=1 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=no -p ${server.port} ${server.user}@${server.hostname} "echo Connection successful"`;
  const sshCommandNoBatchMode = `timeout 2 ssh ${verboseFlag} -o ConnectTimeout=2 -o ServerAliveInterval=1 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=no -p ${server.port} ${server.user}@${server.hostname} "echo Connection successful" 2>&1 || true`;

  try {
    // Try with BatchMode (key authentication only) - this should fail if we reach here
    await execPromise(sshCommandBatchMode);

    // If we get here, the connection was successful with some default key
    return {
      success: true,
      message: 'Connection successful with default SSH key',
      method: 'key',
      user: server.user,
    };
  } catch (error: any) {
    // Connection failed with BatchMode, analyze the error message
    const stderr = error.stderr || '';

    // Check for network connectivity issues
    if (
      stderr.includes('Connection timed out') ||
      stderr.includes('No route to host') ||
      stderr.includes('Network is unreachable')
    ) {
      return {
        success: false,
        message: 'Network connectivity issue. Cannot reach host.',
      };
    }

    // Check for SSH port connectivity issues
    if (stderr.includes('Connection refused')) {
      return {
        success: false,
        message: `SSH port ${server.port} is closed or blocked.`,
      };
    }

    // Check for authentication issues
    if (
      stderr.includes('Permission denied (publickey)') ||
      stderr.includes('Permission denied (publickey,password)')
    ) {
      // Check if password authentication is explicitly disabled
      if (stderr.includes('Permission denied (publickey)') && !stderr.includes('password')) {
        // Server only allows publickey authentication - password auth is likely disabled
        if (!options.suppressDebugOutput) {
          logger.verbose(
            'Server appears to have password authentication disabled (publickey only)'
          );
        }
        return {
          success: false,
          message:
            'SSH key authentication failed. Server appears to have password authentication disabled.',
          method: 'password-disabled',
          user: server.user,
        };
      }

      // This means the server rejected all SSH keys, try to detect password authentication
      if (!options.suppressDebugOutput) {
        logger.verbose('All SSH keys rejected, testing for password authentication...');
      }

      try {
        // Try without BatchMode (allows password prompts)
        const result = await execPromise(sshCommandNoBatchMode);

        // Check if the output contains a password prompt or success message
        if (result.stdout?.includes('Connection successful')) {
          return {
            success: true,
            message: 'Connection successful',
            method: 'key',
            user: server.user,
          };
        }

        if (
          result.stderr &&
          (result.stderr.includes('password:') ||
            result.stderr.includes('Password:') ||
            result.stderr.includes('password for'))
        ) {
          return {
            success: false,
            message: 'Server requires password authentication (password prompt detected)',
            method: 'password-required',
            user: server.user,
          };
        }

        // If we get here without an error, the connection might have succeeded
        return {
          success: false,
          message: 'SSH key authentication failed, server accepts password authentication',
          method: 'password-possible',
          user: server.user,
        };
      } catch (_noBatchError: any) {
        const noBatchStderr = _noBatchError.stderr || '';

        // Check if the error indicates password authentication is disabled
        if (
          noBatchStderr.includes('Permission denied (publickey)') &&
          !noBatchStderr.includes('password')
        ) {
          return {
            success: false,
            message: 'SSH key authentication failed. Server has password authentication disabled.',
            method: 'password-disabled',
            user: server.user,
          };
        }

        // Even without BatchMode, we still got an error
        // For all networks, assume authentication is possible with password
        return {
          success: false,
          message: 'SSH key authentication failed, server likely requires password authentication',
          method: 'password-required',
          user: server.user,
        };
      }
    }

    // Check for host key verification issues
    if (stderr.includes('Host key verification failed')) {
      return {
        success: false,
        message: 'Host key verification failed. Try adding the host to known_hosts.',
      };
    }

    // Check for specific key issues
    if (stderr.includes('invalid format') || stderr.includes('bad permissions')) {
      return {
        success: false,
        message: 'SSH key format issue or bad permissions. Check your key file.',
      };
    }

    // Report the error
    return {
      success: false,
      message: `SSH connection error: ${stderr}`,
    };
  }
}

/**
 * Test SSH connection with a specific key using system SSH command
 *
 * @param server Server configuration
 * @param keyPath Path to the SSH key
 * @param options Options for connection test
 * @returns Promise resolving to a result object with success status and detailed message
 */
export async function testConnectionWithKey(
  server: ServerConfig,
  keyPath: string,
  options: { suppressDebugOutput?: boolean } = {}
): Promise<{
  success: boolean;
  message: string;
  method?: string;
  user?: string;
  keyPath?: string;
}> {
  // Expand tilde in key path
  const expandedKeyPath = expandTilde(keyPath);

  // Determine whether to use verbose mode (-v) based on suppressDebugOutput option
  const verboseFlag = options.suppressDebugOutput ? '' : '-v';

  // Construct the SSH command with the specific key (use gtimeout if available, otherwise rely on SSH timeout)
  const sshCommand = `ssh ${verboseFlag} -o BatchMode=yes -o ConnectTimeout=1 -o ServerAliveInterval=1 -o ServerAliveCountMax=1 -o StrictHostKeyChecking=no -i "${expandedKeyPath}" -p ${server.port} ${server.user}@${server.hostname} "echo Connection successful"`;

  try {
    // Execute the SSH command
    await execPromise(sshCommand);

    // If we get here, the connection was successful
    return {
      success: true,
      message: 'Connection successful',
      method: 'key',
      user: server.user,
      keyPath: expandedKeyPath,
    };
  } catch (error: any) {
    // Connection failed, analyze the error message
    const stderr = error.stderr || '';
    const errorMessage = error.message || '';

    // Check for network connectivity issues
    if (
      stderr.includes('Connection timed out') ||
      stderr.includes('No route to host') ||
      stderr.includes('Network is unreachable') ||
      errorMessage.includes('Connection timed out') ||
      errorMessage.includes('No route to host') ||
      errorMessage.includes('Network is unreachable')
    ) {
      return {
        success: false,
        message: 'Network connectivity issue. Cannot reach host.',
      };
    }

    // Check for SSH port connectivity issues
    if (stderr.includes('Connection refused') || errorMessage.includes('Connection refused')) {
      return {
        success: false,
        message: `SSH port ${server.port} is closed or blocked.`,
      };
    }

    // Check for authentication issues (most common case)
    if (stderr.includes('Permission denied') || errorMessage.includes('Permission denied')) {
      // Check if server only supports password authentication (no publickey support)
      if (stderr.includes('Permission denied (password)') && !stderr.includes('publickey')) {
        return {
          success: false,
          message: `Server only supports password authentication, no publickey support: ${expandedKeyPath}`,
        };
      }

      return {
        success: false,
        message: `Authentication failed with key: ${expandedKeyPath}`,
      };
    }

    // Check for key file issues (only if file actually doesn't exist)
    if (
      (stderr.includes('No such file or directory') ||
        errorMessage.includes('No such file or directory')) &&
      (stderr.includes(expandedKeyPath) || errorMessage.includes(expandedKeyPath))
    ) {
      return {
        success: false,
        message: `SSH key file not found: ${expandedKeyPath}`,
      };
    }

    // Check for key format issues
    if (
      stderr.includes('invalid format') ||
      stderr.includes('bad permissions') ||
      errorMessage.includes('invalid format') ||
      errorMessage.includes('bad permissions')
    ) {
      return {
        success: false,
        message: `SSH key format issue or bad permissions: ${expandedKeyPath}`,
      };
    }

    // Default error message
    return {
      success: false,
      message: `SSH connection failed with key ${expandedKeyPath}: ${errorMessage}`,
    };
  }
}

/**
 * Test SSH connection with password using system SSH command and sshpass
 * Note: This requires sshpass to be installed on the system
 *
 * @param server Server configuration
 * @param password SSH password
 * @param options Options for connection test
 * @returns Promise resolving to a result object with success status and detailed message
 */
export async function testConnectionWithPassword(
  server: ServerConfig,
  password: string,
  options: { suppressDebugOutput?: boolean } = {}
): Promise<{
  success: boolean;
  message: string;
  method?: string;
  user?: string;
}> {
  // Determine whether to use verbose mode (-v) based on suppressDebugOutput option
  const verboseFlag = options.suppressDebugOutput ? '' : '-v';

  // First try using expect script to automatically enter password
  const expectScript = `
expect << EOF
spawn ssh ${verboseFlag} -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${server.port} ${server.user}@${server.hostname} "echo Connection successful"
expect {
  "password:" { send "${password}\\r"; exp_continue }
  "Connection successful" { exit 0 }
  timeout { exit 1 }
  eof { exit 2 }
}
EOF
  `;

  try {
    // Try using expect script
    await execPromise(expectScript);

    // 如果成功，返回成功结果
    return {
      success: true,
      message: 'Connection successful',
      method: 'password',
      user: server.user,
    };
  } catch (_expectError: any) {
    // If expect fails, try using sshpass
    const sshCommand = `sshpass -p "${password}" ssh ${verboseFlag} -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${server.port} ${server.user}@${server.hostname} "echo Connection successful"`;

    try {
      // Execute sshpass command
      await execPromise(sshCommand);

      // If successful, return success result
      return {
        success: true,
        message: 'Connection successful',
        method: 'password',
        user: server.user,
      };
    } catch (sshpassError: any) {
      // Analyze error information
      const stderr = sshpassError.stderr || '';

      // Check if sshpass is installed
      if (sshpassError.message.includes('command not found')) {
        // If sshpass is not installed, try using regular SSH command and manually prompt for password
        // Import logger
        const { default: logger } = await import('../utils/logger.js');
        const sshLogger = logger.createChild('ssh');
        sshLogger.verbose('sshpass is not installed. Trying direct SSH command...');

        // Use regular SSH command, but this will require user to manually enter password
        const directSshCommand = `ssh ${verboseFlag} -o ConnectTimeout=5 -o StrictHostKeyChecking=no -p ${server.port} ${server.user}@${server.hostname} "echo Connection successful"`;

        try {
          await execPromise(directSshCommand);
          return {
            success: true,
            message: 'Connection successful with manual password entry',
            method: 'password',
            user: server.user,
          };
        } catch (_directSshError: any) {
          // 即使直接SSH命令失败，我们也假设密码认证是可能的
          return {
            success: true,
            message: 'Server requires password authentication',
            method: 'password-required',
            user: server.user,
          };
        }
      }

      // 继续处理sshpass的其他错误

      // Check for network connectivity issues
      if (
        stderr.includes('Connection timed out') ||
        stderr.includes('No route to host') ||
        stderr.includes('Network is unreachable')
      ) {
        return {
          success: false,
          message: 'Network connectivity issue. Cannot reach host.',
        };
      }

      // Check for SSH port connectivity issues
      if (stderr.includes('Connection refused')) {
        return {
          success: false,
          message: `SSH port ${server.port} is closed or blocked.`,
        };
      }

      // Check for authentication issues
      if (stderr.includes('Permission denied')) {
        // 检查是否是密码错误还是其他认证问题
        if (
          stderr.includes('Permission denied (publickey,password)') ||
          stderr.includes('Permission denied (publickey)')
        ) {
          return {
            success: false,
            message:
              'Authentication failed. The password may be incorrect or the server may not accept password authentication.',
          };
        }
        return {
          success: false,
          message: 'Authentication failed. Incorrect password.',
        };
      }

      // Default error message
      return {
        success: false,
        message: `SSH connection failed: ${sshpassError.message}`,
      };
    }
  }
}

/**
 * Diagnose SSH connection issues using system SSH command
 * This function uses the system's SSH client to diagnose connection issues
 *
 * @param server Server configuration
 * @param options Options for diagnosis
 * @returns Promise resolving to a detailed diagnosis result
 */
export async function diagnoseConnectionWithSystemSSH(
  server: ServerConfig,
  options: { suppressDebugOutput?: boolean } = {}
): Promise<{
  overallSuccess: boolean;
  primaryIssue: 'none' | 'network' | 'port' | 'authentication';
  detailedMessage: string;
  networkConnectivity: { success: boolean; message: string };
  sshPortConnectivity: { success: boolean; message: string };
  sshAuthentication: { success: boolean; message: string; method?: string; keyPath?: string };
}> {
  const result = {
    overallSuccess: false,
    primaryIssue: 'none' as 'none' | 'network' | 'port' | 'authentication',
    detailedMessage: '',
    networkConnectivity: { success: true, message: 'Not tested (direct SSH attempted first)' },
    sshPortConnectivity: { success: true, message: 'Not tested (direct SSH attempted first)' },
    sshAuthentication: { success: false, message: '', method: '', keyPath: '' },
  };

  // Step 1: Try direct SSH connection first (fastest approach)
  if (!options.suppressDebugOutput) {
    logger.verbose(
      `Testing SSH connection directly to ${server.user}@${server.hostname}:${server.port}...`
    );
  }

  // Try direct SSH connection first
  const authResult = await testConnectionWithSystemSSH(server, {
    suppressDebugOutput: options.suppressDebugOutput,
  });
  result.sshAuthentication = {
    success: authResult.success,
    message: authResult.message,
    method: authResult.method || '',
    keyPath: authResult.keyPath || '',
  };

  // 如果服务器配置中已经包含密码，我们应该尝试直接使用密码认证
  // Try to get password from session manager
  const password = sessionPasswordManager.getPassword(server.hostname, server.user);
  if (password) {
    // 尝试使用密码认证
    const passwordAuthResult = await testConnectionWithPassword(server, password, {
      suppressDebugOutput: options.suppressDebugOutput,
    });

    if (passwordAuthResult.success) {
      // 密码认证成功
      result.sshAuthentication = {
        success: true,
        message: 'Authentication successful with password',
        method: 'password',
        keyPath: '',
      };
      result.overallSuccess = true;
      result.primaryIssue = 'none';
      result.detailedMessage = 'Connection successful with password authentication.';
      return result;
    }
  }

  // 处理SSH连接结果
  if (authResult.success) {
    // SSH连接成功
    result.overallSuccess = true;
    result.primaryIssue = 'none';
    result.detailedMessage = 'Connection successful!';
    return result;
  }

  // SSH连接失败，分析错误原因
  if (!options.suppressDebugOutput) {
    logger.verbose('SSH connection failed, analyzing error...');
  }

  // 检查是否是网络连接问题
  if (
    authResult.message.includes('Connection timed out') ||
    authResult.message.includes('No route to host') ||
    authResult.message.includes('Network is unreachable') ||
    authResult.message.includes('Cannot reach host')
  ) {
    if (!options.suppressDebugOutput) {
      logger.verbose('Running network connectivity test...');
    }

    // 进行详细的网络测试
    try {
      const pingCommand = `ping -c 1 -W 2 ${server.hostname}`;
      await execPromise(pingCommand);
      result.networkConnectivity = { success: true, message: 'Host is reachable (ping)' };
    } catch (_error: any) {
      result.networkConnectivity = { success: false, message: 'Host is unreachable' };
      result.primaryIssue = 'network';
      result.detailedMessage = `Error: Cannot reach host ${server.hostname}. Please check your network connection or verify the host is online.`;
      return result;
    }
  }

  // 检查是否是端口连接问题
  if (
    authResult.message.includes('Connection refused') ||
    authResult.message.includes('port') ||
    authResult.message.includes('closed or blocked')
  ) {
    if (!options.suppressDebugOutput) {
      logger.verbose('Running SSH port connectivity test...');
    }

    // 进行详细的端口测试
    try {
      const portCommand = `nc -z -w 2 ${server.hostname} ${server.port}`;
      await execPromise(portCommand);
      result.sshPortConnectivity = { success: true, message: `SSH port ${server.port} is open` };
    } catch (_error: any) {
      result.sshPortConnectivity = {
        success: false,
        message: `SSH port ${server.port} is closed or blocked`,
      };
      result.primaryIssue = 'port';
      result.detailedMessage = `Error: SSH port ${server.port} is not accessible. Please verify the port is correct and SSH service is running.`;
      return result;
    }
  }

  // 如果不是网络或端口问题，则是认证问题
  if (authResult.method === 'password-disabled') {
    result.primaryIssue = 'authentication';
    result.detailedMessage =
      'SSH key authentication failed. Server has password authentication disabled. Please check your SSH keys or contact the server administrator.';
  } else if (
    authResult.method === 'password-required' ||
    authResult.method === 'password-possible'
  ) {
    result.primaryIssue = 'authentication';
    result.detailedMessage = 'SSH key authentication failed. Password authentication required.';
  } else {
    result.primaryIssue = 'authentication';
    result.detailedMessage = `Error: ${authResult.message}`;
  }

  return result;
}
