/**
 * Server Connection Utilities
 *
 * This module provides functions for establishing and testing SSH connections to servers.
 * It includes functionality for:
 * -Testing connections with retry mechanisms
 * -Interactive authentication handling
 * -Diagnosing connection issues
 * -Saving successful connection information
 *
 * The module is designed to provide a user-friendly experience when connecting to servers,
 * with clear error messages and interactive prompts when needed.
 */

import { sessionPasswordManager } from '../ssh/session-password-manager.js';
import { logger } from '../utils/logger.js';
import { diagnoseConnection } from '../utils/ssh.js';
import type { PreconnectConnectionResult, PreconnectServerConfig } from './types.js';

/**
 * Test connection to a server with retry mechanism
 *
 * This function attempts to connect to a server and offers retry options if the connection fails.
 * It uses the diagnoseConnection utility to identify specific connection issues and provides
 * appropriate feedback to the user.
 *
 * The function will:
 * 1. Attempt to connect to the server
 * 2. If successful, return true
 * 3. If unsuccessful, diagnose the issue and:
 *    -For authentication issues: break the retry loop (auth issues need different handling)
 *    -For network/port issues: offer to retry up to maxRetries times
 *
 * @param serverConfig -Server configuration object containing connection details
 * @param maxRetries -Maximum number of retry attempts (default: 3)
 * @param nonInteractive -If true, will not prompt the user for retry confirmation (default: false)
 *
 * @returns A boolean indicating whether the connection was successful
 */
export async function testConnectionWithRetry(
  serverConfig: PreconnectServerConfig,
  maxRetries = 3,
  nonInteractive = false
): Promise<boolean> {
  let retryCount = 0;
  let isConnected = false;

  // Try to connect up to maxRetries times
  while (retryCount < maxRetries && !isConnected) {
    // Show retry attempt message if this is not the first attempt
    if (retryCount > 0) {
      logger.warn(`Retrying connection (attempt ${retryCount + 1}/${maxRetries})...`);
    }

    logger.info(
      `Verifying connection to ${serverConfig.user}@${serverConfig.hostname}:${serverConfig.port}...`
    );

    try {
      // Attempt to diagnose the connection (show debug output for better user experience)
      const diagnostics = await diagnoseConnection(serverConfig, { suppressDebugOutput: false });
      isConnected = diagnostics?.overallSuccess || false;

      if (isConnected) {
        // Connection successful
        logger.feedback('Connection successful!', true);
        return true;
      }
      // Connection failed -show diagnostic information
      logger.feedback(`Connection failed: ${diagnostics?.primaryIssue || 'unknown'}`, false);
      logger.feedback(diagnostics?.detailedMessage || 'Unknown error', false);

      // If it's an authentication issue, break the retry loop
      // Authentication issues need different handling (credential prompts)
      if (diagnostics?.primaryIssue === 'authentication') {
        break;
      }
    } catch (error) {
      // Handle unexpected errors
      logger.error(
        `Error testing connection: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Increment retry counter
    retryCount++;

    // If we haven't reached max retries and still not connected, ask if user wants to retry
    if (retryCount < maxRetries && !isConnected && !nonInteractive) {
      // Ask if the user wants to retry
      const inquirer = await import('inquirer');
      const { retry } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: 'Do you want to retry the connection?',
          default: true,
        },
      ]);

      if (!retry) {
        logger.warn('Connection process cancelled by user.');
        return false;
      }
    } else if (retryCount < maxRetries && !isConnected && nonInteractive) {
      // In non-interactive mode, automatically retry without prompting
      logger.warn('Automatically retrying in non-interactive mode...');
      // Add a small delay before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Return final connection status
  return isConnected;
}

/**
 * Connect to a server with interactive authentication if needed
 *
 * This function attempts to establish an SSH connection to a server, handling various
 * connection scenarios including:
 * -Network/port issues with retry mechanism
 * -Authentication failures with interactive credential prompts
 * -Successful connections with proper authentication method detection
 *
 * The function follows these steps:
 * 1. Try to connect with provided credentials
 * 2. If connection fails:
 *    -For network/port issues: offer retry options
 *    -For authentication issues: prompt for alternative credentials
 * 3. If connection succeeds:
 *    -Verify the authentication method used
 *    -Create and return a server configuration
 *
 * @param host -Server hostname or IP address
 * @param port -Server SSH port (defaults to 22)
 * @param username -SSH username to connect with
 * @param options -Connection options
 *   -password: SSH password (optional)
 *   -privateKey: Path to SSH private key file (optional)
 *   -maxRetries: Maximum number of connection retry attempts (default: 3)
 *   -exitOnFailure: Exit process on connection failure (default: false)
 *   -nonInteractive: Skip interactive prompts (default: false)
 *
 * @returns A PreconnectConnectionResult object containing:
 *   -success: Boolean indicating if the connection was successful
 *   -authType: Authentication type used ('password' or 'key')
 *   -authValue: Authentication value used (password or key path)
 *   -serverConfig: Server configuration object (if successful)
 *   -errorMessage: Error message (if unsuccessful)
 */
export async function connectToServer(
  host: string,
  port: number,
  username: string,
  options: {
    password?: string;
    privateKey?: string;
    maxRetries?: number;
    exitOnFailure?: boolean;
    nonInteractive?: boolean;
  } = {}
): Promise<PreconnectConnectionResult> {
  logger.info(`Connecting to ${username}@${host}:${port}...`);

  // Create a server config for the initial connection attempt
  const initialServerConfig: PreconnectServerConfig = {
    name: `temp-${host.replace(/[^a-zA-Z0-9]/g, '-')}`,
    hostname: host,
    port,
    user: username,
    identity_file: options.password ? undefined : options.privateKey,
  };

  // First, try to connect with the provided credentials (suppress debug output)
  logger.info('Verifying connection to server...');
  const diagnostics = await diagnoseConnection(initialServerConfig, { suppressDebugOutput: true });

  // If it is password authentication, we need special processing
  if (options.password && diagnostics?.primaryIssue === 'authentication') {
    logger.warn('Password authentication detected. Trying direct connection...');

    // Try password authentication directly using test connection
    try {
      const { testConnection } = await import('../utils/ssh.js');
      const testResult = await testConnection(initialServerConfig);

      if (testResult.success) {
        logger.success('Connection successful with password!');
        if (diagnostics) {
          diagnostics.overallSuccess = true;
          diagnostics.primaryIssue = 'none';
          diagnostics.detailedMessage = 'Connection successful with password';
          diagnostics.sshAuthentication.success = true;
          diagnostics.sshAuthentication.message = 'Authentication successful with password';
          diagnostics.sshAuthentication.method = 'password';
        }
      }
    } catch (error) {
      logger.error(
        `Error testing direct connection: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const isConnected = diagnostics?.overallSuccess || false;

  // Check for hostname resolution errors first
  if (
    diagnostics?.primaryIssue === 'network' &&
    (diagnostics?.detailedMessage?.includes('Could not resolve hostname') ||
      diagnostics?.detailedMessage?.includes('nodename nor servname provided') ||
      diagnostics?.detailedMessage?.includes('Name or service not known'))
  ) {
    logger.error('Connection failed: Unable to resolve hostname');
    logger.error('Please check if the server exists and is correctly spelled.');

    if (options.exitOnFailure) {
      process.exit(0);
    }

    return {
      success: false,
      errorMessage: diagnostics?.detailedMessage || 'Unknown hostname resolution error',
    };
  }

  // If connection successful
  if (isConnected) {
    // Connection successful
    logger.success('Connection successful!');

    // Determine the authentication method that was actually used
    let authType = options.password ? 'password' : 'key';
    let authValue = options.password || options.privateKey || '';

    // If it is a password authentication requirement, but no password is provided, prompt the user to enter the password
    if (
      diagnostics?.sshAuthentication?.method === 'password-required' ||
      diagnostics?.sshAuthentication?.method === 'password-possible'
    ) {
      logger.warn('Server requires password authentication.');

      // Force password authentication
      authType = 'password';

      if (!options.password && !options.nonInteractive) {
        // Prompt for password in interactive mode
        const inquirer = await import('inquirer');
        const { password } = await inquirer.default.prompt([
          {
            type: 'password',
            name: 'password',
            message: `Password for ${username}@${host}:`,
            mask: '*',
          },
        ]);

        authValue = password;
        logger.success('Using password authentication.');

        // Save password to session manager
        sessionPasswordManager.savePassword(host, username, password);

        // Retest connection with a new password
        const { testConnection } = await import('../utils/ssh.js');
        const testResult = await testConnection({
          name: `temp-${host.replace(/[^a-zA-Z0-9]/g, '-')}`,
          hostname: host,
          port,
          user: username,
          // Password will be handled by session manager
        });

        if (!testResult.success) {
          logger.error(`Password authentication failed: ${testResult.message}`);
          return await handleAuthenticationIssues(host, port, username, {
            ...options,
            password,
          });
        }
      } else if (options.password) {
        // Use the provided password
        authValue = options.password;
        logger.success('Using provided password for authentication.');
      } else {
        // In non-interactive mode, just use whatever worked
        logger.warn('Using default authentication in non-interactive mode.');
      }
    }
    // If no password was provided and SSH key authentication had issues,
    // prompt for password authentication instead
    else if (
      !options.password &&
      (!diagnostics?.sshAuthentication?.success ||
        diagnostics?.detailedMessage?.includes('No valid SSH keys found') ||
        diagnostics?.detailedMessage?.includes('keys were rejected'))
    ) {
      logger.warn('No valid SSH keys found or keys were rejected.');

      if (options.nonInteractive) {
        // In non-interactive mode, just use whatever worked
        logger.warn('Using default authentication in non-interactive mode.');
      } else {
        // Prompt for password in interactive mode
        const inquirer = await import('inquirer');
        const { password } = await inquirer.default.prompt([
          {
            type: 'password',
            name: 'password',
            message: `Password for ${username}@${host}:`,
            mask: '*',
          },
        ]);

        authType = 'password';
        authValue = password;
        logger.success('Using password authentication.');

        // Save password to session manager
        sessionPasswordManager.savePassword(host, username, password);
      }
    } else if (authType === 'key' && authValue) {
      // Display the key path being used
      logger.success(`Using key authentication: ${authValue}`);
    } else if (authType === 'key') {
      // Using default key search
      logger.success('Using default SSH key authentication.');
    } else {
      // Using password
      logger.success('Using password authentication.');
    }

    // Create server config with the successful connection details
    const serverConfig: PreconnectServerConfig = {
      name: `temp-${host.replace(/[^a-zA-Z0-9]/g, '-')}`,
      hostname: host,
      port,
      user: username,
      identity_file: authType === 'key' ? authValue : undefined,
    };

    return {
      success: true,
      authType,
      authValue,
      serverConfig,
    };
  }
  logger.feedback(`Connection failed: ${diagnostics?.primaryIssue || 'unknown'}`, false);
  logger.feedback(diagnostics?.detailedMessage || 'Unknown error', false);

  // Handle different types of connection issues
  if (diagnostics?.primaryIssue === 'network' || diagnostics?.primaryIssue === 'port') {
    // Handle network or port issues with retry mechanism
    return await handleNetworkIssues(host, port, username, options, diagnostics);
  }
  if (diagnostics?.primaryIssue === 'authentication') {
    // Handle authentication issues with interactive credential prompts
    return await handleAuthenticationIssues(host, port, username, options);
  }
  // Handle other issues
  const errorMessage = `Connection failed: ${diagnostics?.primaryIssue || 'unknown'}. ${diagnostics?.detailedMessage || 'Unknown error'}`;
  logger.error(errorMessage);

  if (options.exitOnFailure) {
    logger.error('Exiting due to connection failure.');
    process.exit(0);
  }

  return {
    success: false,
    errorMessage,
  };
}

/**
 * Handle network or port issues during connection
 *
 * This is a helper function for connectToServer that specifically handles
 * network and port-related connection issues with a retry mechanism.
 *
 * @param host -Server hostname or IP address
 * @param port -Server SSH port
 * @param username -SSH username
 * @param options -Connection options
 * @param initialDiagnostics -Initial connection diagnostics
 * @returns Connection result
 */
async function handleNetworkIssues(
  host: string,
  port: number,
  username: string,
  options: {
    password?: string;
    privateKey?: string;
    maxRetries?: number;
    exitOnFailure?: boolean;
    nonInteractive?: boolean;
  },
  _initialDiagnostics: any
): Promise<PreconnectConnectionResult> {
  let retryCount = 0;
  const maxRetries = options.maxRetries || 3;
  let isConnected = false;
  let shouldContinueRetrying = true;

  // Try to connect up to maxRetries times
  while (retryCount < maxRetries && !isConnected && shouldContinueRetrying) {
    // In interactive mode, ask if the user wants to retry
    if (options.nonInteractive) {
      // In non-interactive mode, automatically retry
      logger.warn(
        `Automatically retrying in non-interactive mode (${retryCount + 1}/${maxRetries})...`
      );
      // Add a small delay before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      const inquirer = await import('inquirer');
      const { retry } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'retry',
          message: `Retry connection? (Attempt ${retryCount + 1}/${maxRetries})`,
          default: true,
        },
      ]);

      shouldContinueRetrying = retry;

      if (!retry) {
        logger.error('Connection process cancelled by user.');
        if (options.exitOnFailure) {
          process.exit(0);
        }
        return {
          success: false,
          errorMessage: 'Connection process cancelled by user.',
        };
      }
    }

    logger.info(`Retrying connection to ${username}@${host}:${port}...`);

    // Create a server config for retry
    const serverConfig: PreconnectServerConfig = {
      name: `temp-${host.replace(/[^a-zA-Z0-9]/g, '-')}`,
      hostname: host,
      port,
      user: username,
      identity_file: options.password ? undefined : options.privateKey,
    };

    // Retry the connection (suppress debug output)
    const retryDiagnostics = await diagnoseConnection(serverConfig, { suppressDebugOutput: true });
    isConnected = retryDiagnostics?.overallSuccess || false;

    if (isConnected) {
      // Connection successful
      logger.feedback('Connection successful!', true);

      return {
        success: true,
        authType: options.password ? 'password' : 'key',
        authValue: options.password || options.privateKey || '',
        serverConfig,
      };
    }
    // Still failed
    logger.feedback(retryDiagnostics?.detailedMessage || 'Unknown error', false);

    // If it's now an authentication issue, break the retry loop and handle auth
    if (retryDiagnostics?.primaryIssue === 'authentication') {
      return await handleAuthenticationIssues(host, port, username, options);
    }

    // Increment retry count
    retryCount++;

    // If we've reached the maximum retries, show a final error message
    if (retryCount >= maxRetries) {
      const errorMessage = `Connection failed after ${retryCount} attempts. Please check your network and server settings.`;
      logger.error(errorMessage);

      if (options.exitOnFailure) {
        process.exit(0);
      }

      return {
        success: false,
        errorMessage,
      };
    }
  }

  // If we get here, all connection attempts failed
  return {
    success: false,
    errorMessage: 'All connection attempts failed.',
  };
}

/**
 * Handle authentication issues during connection
 *
 * This is a helper function for connectToServer that specifically handles
 * authentication-related connection issues with interactive credential prompts.
 *
 * @param host -Server hostname or IP address
 * @param port -Server SSH port
 * @param username -SSH username
 * @param options -Connection options
 * @returns Connection result
 */
async function handleAuthenticationIssues(
  host: string,
  port: number,
  username: string,
  options: {
    password?: string;
    privateKey?: string;
    maxRetries?: number;
    exitOnFailure?: boolean;
    nonInteractive?: boolean;
  }
): Promise<PreconnectConnectionResult> {
  // In non-interactive mode, we can't prompt for credentials
  if (options.nonInteractive) {
    const errorMessage =
      'Authentication failed and cannot prompt for credentials in non-interactive mode.';
    logger.error(errorMessage);

    if (options.exitOnFailure) {
      process.exit(0);
    }

    return {
      success: false,
      errorMessage,
    };
  }

  // If it's an authentication issue, prompt for credentials
  logger.warn('Authentication failed. Please provide credentials.');

  const inquirer = await import('inquirer');
  const { authType } = await inquirer.default.prompt([
    {
      type: 'list',
      name: 'authType',
      message: 'Choose authentication method:',
      choices: [
        { name: 'Password', value: 'password' },
        { name: 'SSH Key', value: 'key' },
      ],
    },
  ]);

  let authValue = '';

  if (authType === 'password') {
    const { password } = await inquirer.default.prompt([
      {
        type: 'password',
        name: 'password',
        message: `Password for ${username}@${host}:`,
        mask: '*',
      },
    ]);
    authValue = password;

    // Save password to session manager
    sessionPasswordManager.savePassword(host, username, password);
  } else {
    const { keyPath } = await inquirer.default.prompt([
      {
        type: 'input',
        name: 'keyPath',
        message: 'Path to SSH key:',
        default: '~/.ssh/id_rsa',
      },
    ]);
    authValue = keyPath;
  }

  // Create a server config with the new credentials
  const serverConfig: PreconnectServerConfig = {
    name: `temp-${host.replace(/[^a-zA-Z0-9]/g, '-')}`,
    hostname: host,
    port,
    user: username,
    identity_file: authType === 'key' ? authValue : undefined,
  };

  // Try up to 3 password authentication
  const maxPasswordAttempts = 3;
  let passwordAttempt = 1;
  let isConnected = false;

  // If it is password authentication, we provide multiple attempts
  if (authType === 'password') {
    while (passwordAttempt <= maxPasswordAttempts && !isConnected) {
      if (passwordAttempt > 1) {
        logger.warn(
          `Password authentication failed. Attempt ${passwordAttempt}/${maxPasswordAttempts}`
        );
        // Re-prompt for password
        const { password } = await inquirer.default.prompt([
          {
            type: 'password',
            name: 'password',
            message: `Password for ${username}@${host} (attempt ${passwordAttempt}/${maxPasswordAttempts}):`,
            mask: '*',
          },
        ]);
        authValue = password;

        // Save password to session manager
        sessionPasswordManager.savePassword(host, username, password);
      }

      // Test connection
      logger.info(`Testing connection to ${username}@${host}:${port} with password...`);

      // Use test connection directly instead of test connection with retry to avoid retry logic
      try {
        // Import the test connection function
        const { testConnection } = await import('../utils/ssh.js');

        // Test connection
        const testResult = await testConnection({
          name: serverConfig.name,
          hostname: serverConfig.hostname,
          port: serverConfig.port,
          user: serverConfig.user,
          // Password will be handled by session manager
        });

        isConnected = testResult.success;

        if (isConnected) {
          logger.success('Connection successful with password!');
        } else {
          logger.error(`Password authentication failed: ${testResult.message}`);
        }
      } catch (error) {
        logger.error(
          `Error testing connection: ${error instanceof Error ? error.message : String(error)}`
        );
        isConnected = false;
      }

      if (isConnected) {
        break;
      }

      passwordAttempt++;
    }
  } else {
    // For ssh key authentication, use normal retry mechanism
    isConnected = await testConnectionWithRetry(serverConfig, options.maxRetries);
  }

  if (isConnected) {
    return {
      success: true,
      authType,
      authValue,
      serverConfig,
    };
  }
  const errorMessage =
    authType === 'password'
      ? `Password authentication failed after ${maxPasswordAttempts} attempts.`
      : 'Connection failed with the provided SSH key.';
  logger.error(errorMessage);

  if (options.exitOnFailure) {
    process.exit(0);
  }

  return {
    success: false,
    errorMessage,
  };
}

/**
 * Save connection information for future use
 *
 * This function saves successful connection information to be reused in future sessions.
 * It saves the connection information to the configuration file using the saveConnection
 * function from the config module.
 *
 * @param serverConfig -Server configuration to save
 * @param options -Options for saving connection information
 *   -silent: If true, suppress log messages (default: false)
 *   -skipSave: If true, don't actually save the connection (default: false)
 */
export async function saveConnectionInfo(
  serverConfig: PreconnectServerConfig,
  options: { silent?: boolean; skipSave?: boolean } = {}
): Promise<void> {
  if (!options.silent) {
    logger.info('Saving connection information...');
  }

  // Skip saving if requested
  if (options.skipSave) {
    if (!options.silent) {
      logger.warn('Connection information saving skipped.');
    }
    return;
  }

  try {
    // Import dynamically to avoid circular dependencies
    const { saveConnection } = await import('../config/connections.js');

    // Convert PreconnectServerConfig to ConnectionInfo
    const connectionInfo = {
      host: serverConfig.hostname,
      user: serverConfig.user,
      authType: (serverConfig.identity_file ? 'key' : 'key') as 'key' | 'password',
      authValue: serverConfig.identity_file,
      port: serverConfig.port,
      name: serverConfig.name,
    };

    // Save the connection
    saveConnection(connectionInfo);

    if (!options.silent) {
      logger.success('Connection information saved for future use.');
    }
  } catch (error) {
    if (!options.silent) {
      logger.warn(
        `Warning: Failed to save connection information: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
