import {
  type ServerConfig,
  diagnoseConnection,
  getLastConnection,
  logger,
  sessionPasswordManager,
  testConnection,
} from '@aship/core';
import search from '@inquirer/search';
import chalk from 'chalk';
import inquirer from 'inquirer';

// Use cleanInputString from @aship/core instead of local implementation
import { cleanInputString } from '@aship/core';

// Alias for backward compatibility
const cleanUserInput = cleanInputString;

// Helper function to remove ANSI color codes
const removeAnsiColors = (text: string): string => {
  // Use a simple approach to remove ANSI escape sequences
  // Look for ESC[ followed by numbers/semicolons and ending with 'm'
  let result = text;
  let escIndex = result.indexOf('\u001b[');
  while (escIndex !== -1) {
    const endIndex = result.indexOf('m', escIndex);
    if (endIndex !== -1) {
      result = result.slice(0, escIndex) + result.slice(endIndex + 1);
    } else {
      break;
    }
    escIndex = result.indexOf('\u001b[');
  }
  return result;
};

/**
 * Connection mode options
 */
export type ConnectionMode = 'direct' | 'named' | 'interactive' | 'reuse';

/**
 * Options for resolving target servers
 */
export interface ResolveServerOptions {
  /**
   * Connection mode
   */
  connectionMode: ConnectionMode;

  /**
   * Host name or IP address (for direct mode)
   */
  host?: string;

  /**
   * Username (for direct mode)
   */
  user?: string;

  /**
   * Password (for direct mode)
   */
  password?: string;

  /**
   * SSH key path (for direct mode)
   */
  key?: string;

  /**
   * Server names (for named mode)
   */
  server?: string;

  /**
   * Non-interactive mode flag
   */
  nonInteractive?: boolean;
}

/**
 * Result of resolving target servers
 */
export interface ResolveServerResult {
  /**
   * Target server configurations
   */
  targetServers: ServerConfig[];

  /**
   * Direct server configuration (if created)
   */
  directServerConfig?: ServerConfig;
}

/**
 * Resolve target servers based on connection mode and options
 * @param config Configuration object
 * @param options Connection options
 * @returns Target servers
 */
export async function resolveTargetServers(
  config: any,
  options: ResolveServerOptions
): Promise<ResolveServerResult> {
  let targetServerNames: string[] = [];
  let directServerConfig: ServerConfig | undefined;

  // Handle different connection modes
  if (options.connectionMode === 'direct' && options.host) {
    // Clean host input to remove any trailing newlines
    options.host = cleanUserInput(options.host || '');

    logger.info(`Using direct server connection to ${options.host}`);

    // Create a temporary server config
    const serverName = `temp-${(options.host || '').replace(/[^a-zA-Z0-9]/g, '-')}`;
    const authType = options.key ? 'key' : options.password ? 'password' : 'key';

    directServerConfig = {
      name: serverName,
      hostname: options.host,
      port: 22,
      user: options.user || 'root',
      identity_file: authType === 'key' ? options.key : undefined,
    };

    // If using password auth, save password in session
    if (authType === 'password' && options.password) {
      sessionPasswordManager.savePassword(options.host, options.user || 'root', options.password);
      logger.verbose(`Saved password for ${options.user || 'root'}@${options.host} in session`);
    }

    // If in interactive mode and missing auth info, prompt for it
    if (!options.nonInteractive) {
      // Load last connection info to use as defaults
      const lastConnection = await getLastConnection();

      // Clean user input if provided
      if (options.user) {
        options.user = cleanUserInput(options.user);
      }

      // Clean password input if provided
      if (options.password) {
        options.password = cleanUserInput(options.password);
      }

      if (!options.user) {
        // Determine a smart default username
        let defaultUser = 'root';
        let userMessage = 'Username:';

        if (lastConnection?.user && lastConnection.user.trim() !== '') {
          // If we have a cached user (not empty), show it clearly
          defaultUser = lastConnection.user;
          userMessage = `Username (previous: ${lastConnection.user}):`;
        } else {
          // If no cache, try to get current system user as a better default
          try {
            const os = await import('node:os');
            const currentUser = os.userInfo().username;
            if (currentUser && currentUser !== 'root') {
              defaultUser = currentUser;
              userMessage = `Username (current user: ${currentUser}):`;
            }
          } catch {
            // Fallback to root if we can't get current user
            defaultUser = 'root';
          }
        }

        const userResponse = await inquirer.prompt([
          {
            type: 'input',
            name: 'user',
            message: userMessage,
            default: defaultUser,
          },
        ]);
        // Clean user input to remove any trailing newlines
        userResponse.user = cleanUserInput(userResponse.user);
        if (directServerConfig) {
          directServerConfig.user = userResponse.user;
        }

        // Save user immediately after input
        if (options.host && userResponse.user) {
          try {
            // Save to connection history directly

            // Save to connection history
            const { ConnectionHistoryManager } = await import('@aship/core');
            const historyManager = new ConnectionHistoryManager();

            await historyManager.addConnection({
              host: options.host,
              username: userResponse.user,
              port: 22,
              identity_file: '~/.ssh/id_rsa',
              lastUsed: Date.now(),
            });
          } catch (error) {
            console.warn(
              chalk.yellow(
                `Failed to save user information: ${error instanceof Error ? error.message : String(error)}`
              )
            );
          }
        }
      }

      if (!options.key && !options.password) {
        // Try to auto-detect SSH keys first
        logger.info('Attempting connection with SSH keys...');

        // This is a simplified version - in a real implementation,
        // we would use the autoConnect function from the SSH utilities
        const keyDetected = false;

        if (!keyDetected) {
          // Determine default auth type from last connection
          const defaultAuthType = lastConnection?.authType || 'key';

          const authResponse = await inquirer.prompt([
            {
              type: 'list',
              name: 'authType',
              message: 'Authentication method:',
              choices: [
                { name: 'Password', value: 'password' },
                { name: 'SSH Key', value: 'key' },
              ],
              default: defaultAuthType,
            },
          ]);

          if (authResponse.authType === 'password') {
            const passwordResponse = await inquirer.prompt([
              {
                type: 'password',
                name: 'password',
                message: `Password for ${directServerConfig.user}@${directServerConfig.hostname}:`,
                mask: '*',
              },
            ]);

            // Store password in session for this connection
            sessionPasswordManager.savePassword(
              directServerConfig.hostname,
              directServerConfig.user,
              passwordResponse.password
            );
          } else {
            const keyResponse = await inquirer.prompt([
              {
                type: 'input',
                name: 'keyPath',
                message: 'Path to SSH key:',
                default:
                  lastConnection?.authType === 'key' ? lastConnection.authValue : '~/.ssh/id_rsa',
              },
            ]);

            // Update identity file path
            directServerConfig.identity_file = keyResponse.keyPath;
          }
        }
      }
    } else if (options.nonInteractive && !options.key && !options.password) {
      logger.error('Error: Either key or password must be specified in non-interactive mode.');
      process.exit(1);
    }

    // Add the temporary server to the configuration
    if (!config.servers) {
      config.servers = [];
    }
    config.servers.push(directServerConfig);

    // Use this server
    targetServerNames = [serverName];
  } else if (options.connectionMode === 'reuse') {
    // Use the last used server (reuse mode only)
    const lastConnection = await getLastConnection();

    if (lastConnection?.host) {
      logger.info(`Reusing previous connection: ${lastConnection.user}@${lastConnection.host}`);

      // Create a temporary server config
      const serverName = `temp-${lastConnection.host.replace(/[^a-zA-Z0-9]/g, '-')}`;

      directServerConfig = {
        name: serverName,
        hostname: lastConnection.host,
        port: lastConnection.port || 22,
        user: lastConnection.user || 'root',
        identity_file: lastConnection.authValue || '~/.ssh/id_rsa',
      };

      // Add the temporary server to the configuration
      if (!config.servers) {
        config.servers = [];
      }
      config.servers.push(directServerConfig);

      // Use this server
      targetServerNames = [serverName];
    } else if (config.servers && config.servers.length > 0) {
      targetServerNames = [config.servers[0].name];
      logger.info(`Reusing server: ${config.servers[0].name}`);
    } else {
      logger.error('Error: No previous connection found and no servers available.');
      process.exit(1);
    }
  } else if (options.connectionMode === 'named' && options.server) {
    targetServerNames = options.server.split(',').map((s: string) => s.trim());
  } else if (options.connectionMode === 'interactive') {
    // Use HostManager for new simplified host selection
    const { HostManager, DirectoryManager } = await import('@aship/core');
    const hostManager = new HostManager(new DirectoryManager());

    // Migrate legacy configuration if needed
    await hostManager.migrateLegacyConfig();

    const hostChoices = await hostManager.getHostChoices();

    if (hostChoices.length > 0) {
      // Build columnar choices list with proper formatting
      const choices: any[] = [];

      // Determine default selection (most recent connection)
      const defaultSelection = await getDefaultSelection(hostChoices, config);

      // Calculate optimal column widths based on terminal size
      const terminalWidth = process.stdout.columns || 80;
      const columns = calculateColumnWidths(hostChoices, terminalWidth);

      // Convert all host choices to columnar format
      hostChoices.forEach(host => {
        // Extract clean name for short display (remove parenthetical content)
        const cleanName = host.name ? host.name.split('(')[0].trim() : 'New host';

        choices.push({
          name: formatColumnChoiceName(host, columns),
          value: host.value,
          short: cleanName,
          source: host.source,
          lastUsed: host.lastUsed,
        });
      });

      // Use a custom searchable list implementation with enhanced messaging
      const response = await searchableListPrompt({
        message: colors.prompt('Select target host'),
        choices,
        defaultSelection,
        pageSize: 15,
      });

      // Handle the response
      if (response.server === 'manual') {
        targetServerNames = [];
      } else {
        targetServerNames = [response.server];

        // All server selections should go through confirmation flow
        const selectedServerInfo = await getSelectedServerInfo(response.server, config);

        // Force all selections to go through confirmation flow
        targetServerNames = [];
        // Store selected server info for pre-filling
        (global as any).selectedServerInfo = selectedServerInfo;
      }
    }

    // If no servers selected or only manual input, fall through to manual input
    if (targetServerNames.length === 0) {
      // Manual input or no servers selected, prompt for direct connection
      logger.subsection('Connection Setup');

      // Load last connection info
      const lastConnection = await getLastConnection();

      // Check if we have pre-filled server info from selection
      const preFilledInfo = (global as any).selectedServerInfo;
      let defaultHost = '';

      if (preFilledInfo) {
        // Pre-fill with selected server info in SSH format
        if (preFilledInfo.user && preFilledInfo.host) {
          defaultHost =
            preFilledInfo.port && preFilledInfo.port !== 22
              ? `${preFilledInfo.user}@${preFilledInfo.host}:${preFilledInfo.port}`
              : `${preFilledInfo.user}@${preFilledInfo.host}`;
        } else if (preFilledInfo.host) {
          defaultHost = preFilledInfo.host;
        }
        // Clear the global variable after use
        (global as any).selectedServerInfo = undefined;
      } else if (lastConnection?.host && lastConnection.host !== 'example.com') {
        defaultHost = lastConnection.host;
      }

      const hostResponse = await inquirer.prompt([
        {
          type: 'input',
          name: 'host',
          message: 'Host:',
          default: defaultHost,
          validate: (input: any) => (input ? true : 'Host is required'),
        },
      ]);

      // Clean host input to remove any trailing newlines
      hostResponse.host = cleanUserInput(hostResponse.host);

      // Parse SSH format input (user@host:port)
      const parsedConnection = parseSSHConnectionString(hostResponse.host);
      const actualHost = parsedConnection.host;
      const parsedUser = parsedConnection.user;
      const parsedPort = parsedConnection.port;

      // Save host immediately after input using new HostManager
      if (actualHost && actualHost !== 'example.com' && actualHost !== '') {
        try {
          // Save to recent connection using HostManager
          await hostManager.saveRecentConnection({
            host: actualHost,
            user: parsedUser,
            port: parsedPort || 22,
            lastInputTime: new Date().toISOString(),
            connectionAttempts: 1,
          });
        } catch (error) {
          logger.warn(
            `Failed to save host information: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Determine port - use parsed port if available, otherwise use smart default
      let finalPort: number;

      if (parsedPort) {
        // Port was provided in SSH format, use it directly
        finalPort = parsedPort;
        logger.verbose(`Using port from SSH format: ${parsedPort}`);
      } else {
        // No port in SSH format, use smart default
        let defaultPort = 22;

        if (preFilledInfo?.port) {
          // Use pre-filled port from selected server
          defaultPort = preFilledInfo.port;
          logger.verbose(`Using port from selected server: ${preFilledInfo.port}`);
        } else if (lastConnection?.port) {
          // Use port from last connection
          defaultPort = lastConnection.port;
          logger.verbose(`Using port from previous connection: ${lastConnection.port}`);
        } else {
          logger.verbose(`Using default SSH port: ${defaultPort}`);
        }

        finalPort = defaultPort;
      }

      // Determine username - use parsed user if available, otherwise prompt
      let finalUser: string;

      if (parsedUser) {
        // User was provided in SSH format, use it directly
        finalUser = parsedUser;
        logger.verbose(`Using username from SSH format: ${parsedUser}`);
      } else {
        // No user in SSH format, prompt for username
        let defaultUser = 'root';
        let userMessage = 'Username:';

        if (preFilledInfo?.user) {
          // Use pre-filled user from selected server
          defaultUser = preFilledInfo.user;
          userMessage = `Username (from selected server: ${preFilledInfo.user}):`;
        } else if (lastConnection?.user && lastConnection.user.trim() !== '') {
          // If we have a cached user (not empty), show it clearly
          defaultUser = lastConnection.user;
          userMessage = `Username (previous: ${lastConnection.user}):`;
        } else {
          // If no cache, try to get current system user as a better default
          try {
            const os = await import('node:os');
            const currentUser = os.userInfo().username;
            if (currentUser && currentUser !== 'root') {
              defaultUser = currentUser;
              userMessage = `Username (current user: ${currentUser}):`;
            }
          } catch {
            // Fallback to root if we can't get current user
            defaultUser = 'root';
          }
        }

        const userResponse = await inquirer.prompt([
          {
            type: 'input',
            name: 'user',
            message: userMessage,
            default: defaultUser,
          },
        ]);

        // Clean user input to remove any trailing newlines
        finalUser = cleanUserInput(userResponse.user);
      }

      // Save user immediately after input using new HostManager
      if (actualHost && finalUser) {
        try {
          // Update recent connection with user info
          await hostManager.saveRecentConnection({
            host: actualHost,
            user: finalUser,
            port: finalPort,
            lastInputTime: new Date().toISOString(),
            connectionAttempts: 1,
          });
        } catch (error) {
          logger.warn(
            `Failed to save user information: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Connection info already saved after each input

      logger.info(`Testing connection to ${finalUser}@${actualHost}...`);

      // Create a temporary server config for testing
      // We don't specify a key path here to allow the system to try all available SSH keys
      const testServerConfig = {
        name: `temp-${actualHost.replace(/[^a-zA-Z0-9]/g, '-')}`,
        hostname: actualHost,
        port: finalPort,
        user: finalUser,
        identity_file: '', // Empty to try all keys
      };

      // Test connection with diagnostics (suppress debug output for cleaner experience)
      const diagnostics = await diagnoseConnection(testServerConfig, {
        suppressDebugOutput: true,
      });

      let isConnected = false;

      // Handle connection issues based on the primary issue
      if (diagnostics.overallSuccess) {
        // True connection successful (SSH key worked)
        logger.success('Connection successful!');

        // Show authentication method used (verbose mode only)
        if (diagnostics.sshAuthentication.method) {
          if (
            diagnostics.sshAuthentication.method === 'password-possible' ||
            diagnostics.sshAuthentication.method === 'password-required'
          ) {
            logger.verbose(
              `Using password authentication: ${diagnostics.sshAuthentication.keyPath || '~/.ssh/id_rsa'}`
            );
          } else if (diagnostics.sshAuthentication.method === 'key') {
            logger.verbose(
              `Using key authentication: ${diagnostics.sshAuthentication.keyPath || '~/.ssh/id_rsa'}`
            );
          } else {
            logger.verbose(`Using ${diagnostics.sshAuthentication.method} authentication`);
          }
        }

        // Create directServerConfig for successful connection
        const tempServerName = `temp-${actualHost.replace(/[^a-zA-Z0-9]/g, '-')}`;

        directServerConfig = {
          name: tempServerName,
          hostname: actualHost,
          port: finalPort,
          user: finalUser,
          identity_file: diagnostics.sshAuthentication.keyPath || '~/.ssh/id_rsa',
        };

        // Add the temporary server to the configuration
        if (!config.servers) {
          config.servers = [];
        }
        config.servers.push(directServerConfig);

        // Use this server
        targetServerNames = [tempServerName];

        // Set connection status
        isConnected = true;
      } else if (
        diagnostics.primaryIssue === 'authentication' &&
        diagnostics.sshAuthentication.method === 'password-disabled'
      ) {
        // SSH keys failed and password authentication is disabled
        logger.feedback('SSH key authentication failed', false);
        logger.feedback('Server has password authentication disabled', false);
        logger.feedback('Please check your SSH keys or contact the server administrator', false);
        logger.feedback(
          'Available SSH keys were tested but none were accepted by the server',
          false
        );
        process.exit(1);
      } else if (
        diagnostics.primaryIssue === 'authentication' &&
        (diagnostics.sshAuthentication.method === 'password-required' ||
          diagnostics.sshAuthentication.method === 'password-possible')
      ) {
        // SSH keys failed, but password authentication is available
        logger.warn('SSH key authentication failed');
        logger.info('Server requires password authentication');

        // Create server config with the successful connection details
        const tempServerName = `temp-${actualHost.replace(/[^a-zA-Z0-9]/g, '-')}`;

        // Implement password retry mechanism
        let passwordAuthSuccess = false;
        let passwordAttempts = 0;
        const maxPasswordAttempts = 3;

        while (!passwordAuthSuccess && passwordAttempts < maxPasswordAttempts) {
          passwordAttempts++;

          // Prompt for password since SSH keys failed
          const passwordResponse = await inquirer.prompt([
            {
              type: 'password',
              name: 'password',
              message:
                passwordAttempts === 1
                  ? `Password for ${finalUser}@${actualHost}:`
                  : `Password for ${finalUser}@${actualHost} (attempt ${passwordAttempts}/${maxPasswordAttempts}):`,
              mask: '*',
              validate: (input: string) => {
                if (!input || input.trim() === '') {
                  return 'Password cannot be empty. Please enter a password.';
                }
                return true;
              },
            },
          ]);

          // Clean password input
          const password = cleanUserInput(passwordResponse.password);

          // Save password in session manager BEFORE testing
          sessionPasswordManager.savePassword(actualHost, finalUser, password);

          // Create server config with password authentication
          directServerConfig = {
            name: tempServerName,
            hostname: actualHost,
            port: finalPort,
            user: finalUser,
            // No identity_file for password auth - SSH will handle password prompting
          };

          // Test the password authentication
          logger.verbose(
            `Testing connection with password for ${finalUser}@${actualHost}:${finalPort}...`
          );

          const passwordTestResult = await testConnection(directServerConfig);

          if (passwordTestResult.success) {
            logger.success('Password authentication successful!');

            // Add the temporary server to the configuration
            if (!config.servers) {
              config.servers = [];
            }
            config.servers.push(directServerConfig);

            // Use this server
            targetServerNames = [tempServerName];

            // Set connection status
            isConnected = true;
            passwordAuthSuccess = true;
          } else {
            if (passwordAttempts < maxPasswordAttempts) {
              logger.feedback('Password authentication failed. Please try again.', false);
            } else {
              logger.feedback('Maximum password attempts reached. Authentication failed.', false);
              logger.feedback('Please check your password and try again later.', false);
              process.exit(1);
            }
          }
        }
      } else {
        // Check for underlying network connection issues (DNS resolution, network connectivity, port issues, etc.)
        if (diagnostics.primaryIssue === 'network') {
          logger.error(diagnostics.detailedMessage);
          process.exit(1);
        }

        if (diagnostics.primaryIssue === 'port') {
          logger.error(diagnostics.detailedMessage);
          process.exit(1);
        }

        // Handle authentication issues
        if (diagnostics.primaryIssue === 'authentication') {
          // Pre-declare authentication method variable, default to key authentication
          let authResponse: { authType: string } = { authType: 'key' };

          // Check if server only supports one authentication method
          if (diagnostics.sshAuthentication.method === 'password-required') {
            // Server only supports password authentication, go directly to password input
            logger.info('Server only supports password authentication.');
            authResponse = { authType: 'password' };
          } else if (diagnostics.sshAuthentication.method === 'key-required') {
            // Server only supports key authentication, skip authentication method selection
            logger.info('Server only supports key authentication.');
            authResponse = { authType: 'key' };
          } else if (diagnostics.sshAuthentication.method === 'password-possible') {
            // Server supports both password and key authentication, all keys have failed
            logger.info(
              'Key authentication failed, server supports multiple authentication methods.'
            );

            // Determine default auth type from last connection
            const defaultAuthType = lastConnection?.authType || 'key';

            // Only show authentication method selection dialog in this case
            authResponse = await inquirer.prompt([
              {
                type: 'list',
                name: 'authType',
                message: 'Authentication method:',
                choices: [
                  { name: 'Password', value: 'password' },
                  { name: 'SSH Key', value: 'key' },
                ],
                default: defaultAuthType,
              },
            ]);
          } else {
            // For other cases, use default key authentication
            const defaultAuthType = lastConnection?.authType || 'key';
            authResponse = { authType: defaultAuthType };
          }

          if (authResponse.authType === 'password') {
            // Loop until password authentication succeeds or user cancels
            let passwordAuthSuccess = false;
            let passwordAttempts = 0;
            const maxPasswordAttempts = 3;

            while (!passwordAuthSuccess && passwordAttempts < maxPasswordAttempts) {
              passwordAttempts++;

              const passwordResponse = await inquirer.prompt([
                {
                  type: 'password',
                  name: 'password',
                  message: `Password for ${finalUser}@${actualHost}:`,
                  mask: '*',
                  validate: (input: string) => {
                    if (!input || input.trim() === '') {
                      return 'Password cannot be empty. Please enter a password.';
                    }
                    return true;
                  },
                },
              ]);

              // Clean password input
              const password = cleanUserInput(passwordResponse.password);

              // Save password in session manager BEFORE testing
              sessionPasswordManager.savePassword(actualHost, finalUser, password);

              // Create server config with password authentication
              const tempServerName = `temp-${actualHost.replace(/[^a-zA-Z0-9]/g, '-')}`;
              directServerConfig = {
                name: tempServerName,
                hostname: actualHost,
                port: finalPort,
                user: finalUser,
                // No identity_file for password auth - SSH will handle password prompting
              };

              logger.verbose('Testing connection with password...');

              // Test connection with password
              const testResult = await testConnection(directServerConfig);

              if (testResult.success) {
                logger.success('Password authentication successful!');
                passwordAuthSuccess = true;
              } else {
                if (passwordAttempts < maxPasswordAttempts) {
                  logger.error('Password authentication failed. Please try again.');
                } else {
                  logger.error('Maximum password attempts reached. Authentication failed.');
                  process.exit(1);
                }
              }
            }

            // Set connection status
            isConnected = true;
          } else {
            const keyResponse = await inquirer.prompt([
              {
                type: 'input',
                name: 'keyPath',
                message: 'Path to SSH key:',
                default:
                  lastConnection?.authType === 'key' ? lastConnection.authValue : '~/.ssh/id_rsa',
              },
            ]);

            // Create server config with key authentication
            const tempServerName = `temp-${actualHost.replace(/[^a-zA-Z0-9]/g, '-')}`;
            directServerConfig = {
              name: tempServerName,
              hostname: actualHost,
              port: finalPort,
              user: finalUser,
              identity_file: keyResponse.keyPath,
            };

            // Test connection with key
            logger.verbose('Testing connection with key...');
            const keyResult = await testConnection(directServerConfig);

            if (keyResult.success) {
              logger.success('Connection successful!');
              isConnected = true;
            } else {
              logger.error(`Connection failed: ${keyResult.message}`);
              process.exit(1);
            }
          }

          // Add the temporary server to the configuration if connected
          if (isConnected && directServerConfig) {
            if (!config.servers) {
              config.servers = [];
            }
            config.servers.push(directServerConfig);
            targetServerNames = [directServerConfig.name];
          }
        }
      }

      // Save successful connection to hosts.yml using HostManager
      if (isConnected && directServerConfig) {
        try {
          // Update recent connection with success status
          await hostManager.saveRecentConnection({
            host: directServerConfig.hostname,
            user: directServerConfig.user,
            port: directServerConfig.port || 22,
            lastInputTime: new Date().toISOString(),
            lastConnectionAttempt: new Date().toISOString(),
            lastConnectionSuccess: true,
            connectionAttempts: 1,
            authType: directServerConfig.identity_file ? 'key' : 'password',
            authValue: directServerConfig.identity_file,
          });

          // Add successful connection to hosts.yml
          await hostManager.addHost({
            hostname: directServerConfig.hostname,
            user: directServerConfig.user,
            port: directServerConfig.port || 22,
            identity_file: directServerConfig.identity_file,
            description: `Added via manual connection on ${new Date().toLocaleDateString()}`,
            source: 'manual',
          });

          // Update usage statistics
          await hostManager.updateUsage(directServerConfig.hostname);

          logger.success('Connection information saved for future use.');
        } catch (error) {
          // If host already exists, just update usage
          if (error instanceof Error && error.message.includes('already exists')) {
            try {
              await hostManager.updateUsage(directServerConfig.hostname);
              logger.verbose('Updated usage statistics for existing host.');
            } catch (usageError) {
              logger.warn(
                `Failed to update usage statistics: ${usageError instanceof Error ? usageError.message : String(usageError)}`
              );
            }
          } else {
            logger.warn(
              `Failed to save connection information: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      }
    }
  }

  // Resolve selected servers using the new unified approach
  let targetServers: any[] = [];

  if (targetServerNames.length > 0) {
    // Use unified configuration manager for resolution
    const { UnifiedConfigManager } = await import('@aship/core');
    const unifiedConfig = new UnifiedConfigManager(process.cwd());

    try {
      targetServers = await resolveSelectedServers(targetServerNames, config, unifiedConfig);

      if (targetServers.length === 0) {
        logger.error('Error: No valid servers found from selection.');
        process.exit(1);
      }
    } catch (error) {
      logger.error(
        `Error resolving servers: ${error instanceof Error ? error.message : String(error)}`
      );
      process.exit(1);
    }
  }

  return {
    targetServers,
    directServerConfig,
  };
}

/**
 * Determine connection mode based on options
 * @param options Command options
 * @param globalOptions Global options
 * @returns Connection mode
 */
export function determineConnectionMode(options: any, globalOptions: any): ConnectionMode {
  if (options.host || globalOptions.host) {
    return 'direct';
  }
  if (options.server || globalOptions.server) {
    return 'named';
  }
  if (options.reuse || globalOptions.reuse) {
    return 'reuse';
  }
  if (options.yes || globalOptions.yes) {
    logger.error('Error: No connection information provided in non-interactive mode.');
    process.exit(1);
  }

  return 'interactive';
}

/**
 * Load configuration from file
 * @param currentDir Current working directory
 * @returns Configuration object
 */
export async function loadConfiguration(currentDir: string): Promise<any> {
  const { UnifiedConfigManager } = await import('@aship/core');
  const unifiedConfig = new UnifiedConfigManager(currentDir);
  const config = await unifiedConfig.loadConfig();

  // Convert to legacy format for backward compatibility
  const legacyConfig = {
    ...config.project,
    servers: config.servers.servers,
    inventoryHosts: config.inventoryHosts,
    connectionHistory: config.connectionHistory,
  };

  return legacyConfig;
}

// fileExists is now imported from @aship/core

/**
 * Enhanced color theme for better contrast and readability
 */
const colors = {
  // Choice states - improved contrast
  recommended: chalk.bold.green, // Bold green for recommended choice
  normal: chalk.white, // White for normal choices

  // Auxiliary info - better visibility
  timeInfo: chalk.dim.cyan, // Dim cyan for time info

  // Special actions - more prominent
  newHost: chalk.bold.yellow, // Bold yellow for new host action

  // Additional UI elements
  prompt: chalk.bold.blue, // Bold blue for prompts
  success: chalk.bold.green, // Bold green for success
  info: chalk.cyan, // Cyan for info
  warning: chalk.yellow, // Yellow for warnings
  error: chalk.red, // Red for errors
};

/**
 * Column configuration for host display
 */
interface ColumnConfig {
  icon: number; // Icon column width
  name: number; // Name column width
  connection: number; // Connection info column width
  time: number; // Time column width
  status: number; // Status column width
}

/**
 * Calculate optimal column widths based on data and terminal width
 */
function calculateColumnWidths(hosts: any[], terminalWidth = 80): ColumnConfig {
  // Reserve space for margins and separators
  const reservedSpace = 8; // spaces between columns and margins
  const availableWidth = Math.max(terminalWidth - reservedSpace, 60); // minimum 60 chars

  // Calculate content widths
  const maxNameWidth = Math.max(4, ...hosts.map(h => (h.name || '').length));
  const maxConnectionWidth = Math.max(
    10,
    ...hosts.map(h => {
      if (h.source === 'manual') return 0;
      const user = h.user || 'user';
      const host = h.host || h.hostname || 'host';
      const port = h.port && h.port !== 22 ? `:${h.port}` : '';
      return `${user}@${host}${port}`.length;
    })
  );

  // Fixed widths
  const iconWidth = 2;
  const timeWidth = 8; // "2h ago", "1d ago"
  const statusWidth = 8; // "unsaved"

  // Calculate dynamic widths
  const fixedTotal = iconWidth + timeWidth + statusWidth;
  const remainingWidth = availableWidth - fixedTotal;

  // Distribute remaining width between name and connection (40/60 split)
  const nameWidth = Math.min(maxNameWidth, Math.floor(remainingWidth * 0.4));
  const connectionWidth = Math.min(maxConnectionWidth, remainingWidth - nameWidth);

  return {
    icon: iconWidth,
    name: nameWidth,
    connection: connectionWidth,
    time: timeWidth,
    status: statusWidth,
  };
}

/**
 * Format host choice with columnar layout
 * @param choice Host choice object
 * @param isDefault Whether this is the default/recommended choice
 * @param columns Column width configuration
 * @returns Formatted choice name with columnar layout
 */
function formatColumnChoiceName(choice: any, columns: ColumnConfig): string {
  if (choice.source === 'manual') {
    // Manual input option - spans across columns
    const icon = colors.newHost('✨');
    const text = colors.newHost('Enter new host...');
    return `${icon} ${text}`;
  }

  // Extract host information
  const baseName = choice.name || 'unnamed';
  const user = choice.user || '';
  const host = choice.host || choice.hostname || '';
  const port = choice.port && choice.port !== 22 ? `:${choice.port}` : '';
  const connection = user && host ? `${user}@${host}${port}` : host;
  const timeAgo = choice.lastUsed ? getTimeAgo(choice.lastUsed) : '';

  // Clean name - remove any parenthetical content
  const name = baseName.split('(')[0].trim();

  // Status column - only show "unsaved" for recent/unsaved connections
  const status = choice.source === 'recent' ? 'unsaved' : '';

  // Format columns with proper truncation
  const icon = colors.normal('•'); // Unified icon for all hosts
  const nameCol = truncateString(name, columns.name);
  const connectionCol = truncateString(connection, columns.connection);
  const timeCol = truncateString(timeAgo, columns.time);
  const statusCol = truncateString(status, columns.status);

  // Apply simplified colors - only use white and yellow
  const styledName = colors.normal(nameCol); // All names in white
  const styledConnection = colors.normal(connectionCol); // All connections in white
  const styledTime = colors.normal(timeCol); // All times in white
  const styledStatus = status ? colors.warning(statusCol) : ''; // Only unsaved in yellow

  // Build formatted string with proper spacing and right-aligned time
  const parts = [
    icon,
    styledName.padEnd(columns.name + getColorOverhead(styledName)),
    styledConnection.padEnd(columns.connection + getColorOverhead(styledConnection)),
    styledTime.padStart(columns.time + getColorOverhead(styledTime)), // Right-align time
    styledStatus,
  ];

  return parts.join(' ').trimEnd();
}

/**
 * Truncate string to fit column width
 */
function truncateString(str: string, maxWidth: number): string {
  if (!str) return '';
  if (str.length <= maxWidth) return str;
  return `${str.slice(0, Math.max(0, maxWidth - 1))}…`;
}

/**
 * Calculate color overhead for proper padding
 * This accounts for ANSI escape sequences that don't contribute to visual width
 */
function getColorOverhead(coloredString: string): number {
  // Remove ANSI escape sequences and calculate the difference
  // Using String.fromCharCode to avoid control character in regex
  const escapeChar = String.fromCharCode(27); // ESC character (0x1b)
  const ansiPattern = new RegExp(`${escapeChar}\[[0-9;]*m`, 'g');
  const plainString = coloredString.replace(ansiPattern, '');
  return coloredString.length - plainString.length;
}

// Removed createColoredSeparator - no longer needed with simplified UI

/**
 * Get default selection based on priority rules
 * @param hostChoices Available host choices (already sorted by usage)
 * @param config Configuration object
 * @returns Default selection value or null
 */
async function getDefaultSelection(hostChoices: any[], _config: any): Promise<string | null> {
  // Since hostChoices are already sorted by lastUsed timestamp (most recent first),
  // just return the first non-manual choice
  const firstChoice = hostChoices.find(choice => choice.source !== 'manual');
  return firstChoice?.value || null;
}

/**
 * Get human-readable time ago string
 * @param timestamp Timestamp in milliseconds
 * @returns Time ago string
 */
function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Find the default index for the given selection in choices array
 * @param choices Array of choices
 * @param defaultSelection Default selection value
 * @returns Index of default selection or 0
 */
function findDefaultIndex(choices: any[], defaultSelection: string | null): number {
  if (!defaultSelection) return 0;

  const index = choices.findIndex(choice => choice.value === defaultSelection);
  return index >= 0 ? index : 0;
}

/**
 * Integrated searchable list prompt that supports real-time filtering
 * @param options Prompt options
 * @returns Selected server response
 */
async function searchableListPrompt(options: {
  message: string;
  choices: any[];
  defaultSelection: string | null;
  pageSize: number;
}): Promise<any> {
  const { message, choices, defaultSelection, pageSize } = options;

  // Create a source function for search that maintains grouping
  const searchSource = async (input: string | undefined, _opt: { signal: AbortSignal }) => {
    const searchTerm = (input || '').toLowerCase().trim();

    // If no search term, return all choices with proper grouping
    if (!searchTerm) {
      return buildSearchChoices(choices, defaultSelection, '');
    }

    // Filter choices while maintaining group structure
    return buildSearchChoices(choices, defaultSelection, searchTerm);
  };

  try {
    const selectedValue = await search({
      message: `${message} ${chalk.dim('(type to filter, ↑↓ to navigate, Enter to select)')}`,
      source: searchSource,
      pageSize,
    });

    return { server: selectedValue };
  } catch (error) {
    // Check if this is a user cancellation (Ctrl+C)
    if (
      error instanceof Error &&
      (error.message.includes('User force closed the prompt') ||
        error.message.includes('canceled') ||
        error.message.includes('cancelled') ||
        error.name === 'ExitPromptError' ||
        error.name === 'AbortError')
    ) {
      // User cancelled, re-throw to exit gracefully
      logger.debug('User cancelled server selection');
      throw error;
    }

    // Only fallback for genuine technical errors, not user cancellation
    logger.warn('Search prompt failed due to technical error, falling back to regular list');
    logger.debug(`Search error: ${error instanceof Error ? error.message : String(error)}`);

    // Manual option should already be included in choices from HostManager.getHostChoices()
    // No need to add it again here in fallback mode

    const response = await inquirer.prompt([
      {
        type: 'list',
        name: 'server',
        message,
        choices,
        default: findDefaultIndex(choices, defaultSelection),
        pageSize,
      },
    ]);

    return response;
  }
}

/**
 * Build search choices for @inquirer/search component
 * @param allChoices All available choices
 * @param defaultSelection Default selection value
 * @param searchTerm Search term for filtering
 * @returns Filtered choices in search format
 */
function buildSearchChoices(
  allChoices: any[],
  _defaultSelection: string | null,
  searchTerm: string
): any[] {
  const result: any[] = [];

  // Filter and format choices
  for (const choice of allChoices) {
    if (choice.type === 'separator') continue;

    // Skip if search term doesn't match
    if (searchTerm && !matchesSearchTerm(choice, searchTerm)) {
      continue;
    }

    const highlightedName = searchTerm ? highlightSearchTerm(choice.name, searchTerm) : choice.name;

    result.push({
      name: highlightedName,
      value: choice.value,
      short: choice.short || '',
    });
  }

  return result;
}

/**
 * Extract searchable text from a choice
 * @param choice Choice object
 * @returns Searchable text
 */
function extractSearchableText(choice: any): string {
  // Remove ANSI color codes for searching
  const cleanName = removeAnsiColors(choice.name);

  // Include description, short name and value for broader search
  const searchParts = [cleanName, choice.description || choice.short || '', choice.value || ''];

  return searchParts.join(' ');
}

/**
 * Highlight search term in choice name
 * @param name Choice name
 * @param searchTerm Search term
 * @returns Highlighted name
 */
function highlightSearchTerm(name: string, searchTerm: string): string {
  if (!searchTerm) return name;

  // Simple highlighting - wrap matching text with background color
  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return name.replace(regex, chalk.bgYellow.black('$1'));
}

/**
 * Check if choice matches search term
 * @param choice Choice object
 * @param searchTerm Search term
 * @returns True if matches
 */
function matchesSearchTerm(choice: any, searchTerm: string): boolean {
  if (!searchTerm) return true;

  const searchText = extractSearchableText(choice).toLowerCase();
  return searchText.includes(searchTerm.toLowerCase());
}

// Removed formatChoiceWithPrefix - no longer needed with simplified UI

/**
 * Resolve server configurations from selected values
 * @param selectedValues Selected server values from the UI
 * @param config Loaded configuration
 * @param unifiedConfig Unified configuration manager
 * @returns Array of server configurations
 */
async function resolveSelectedServers(
  selectedValues: string[],
  config: any,
  unifiedConfig: any
): Promise<any[]> {
  const servers: any[] = [];
  const unifiedConfigData = await unifiedConfig.loadConfig();

  for (const value of selectedValues) {
    if (value.startsWith('inventory:')) {
      // Handle inventory host
      const hostName = value.replace('inventory:', '');
      const inventoryHost = unifiedConfigData.inventoryHosts.find((h: any) => h.name === hostName);

      if (inventoryHost) {
        // Convert inventory host to server config format
        const serverConfig = {
          name: inventoryHost.name,
          host: inventoryHost.host,
          port: inventoryHost.port || 22,
          user: inventoryHost.user || 'root',
          auth: {
            type: 'key',
            value: '~/.ssh/id_rsa',
          },
          description: `From inventory (${inventoryHost.connection || 'ssh'})`,
        };
        servers.push(serverConfig);
      }
    } else if (value.startsWith('history:')) {
      // Handle history connection
      const parts = value.split(':');
      if (parts.length === 3) {
        const [, host, username] = parts;
        const connection = unifiedConfigData.connectionHistory.find(
          (c: any) => c.host === host && c.username === username
        );

        if (connection) {
          // Convert connection to server config format
          const serverConfig = {
            name: `${username}@${host}`,
            host: connection.host,
            port: connection.port || 22,
            user: connection.username,
            auth: {
              type: connection.authType || 'key',
              value: connection.authValue || '~/.ssh/id_rsa',
            },
            description: `History connection (last used: ${new Date(connection.lastUsed).toLocaleString()})`,
          };
          servers.push(serverConfig);
        }
      }
    } else {
      // Handle configured server or group
      const server = config.servers.find((s: any) => s.name === value);
      if (server) {
        servers.push(server);
      }
    }
  }

  return servers;
}

/**
 * Get selected server information for pre-filling
 * @param serverName Selected server name
 * @param config Project configuration
 * @returns Server information or null
 */
async function getSelectedServerInfo(serverName: string, _config: any): Promise<any> {
  // First, try to load from unified configuration manager
  try {
    const { UnifiedConfigManager } = await import('@aship/core');
    const unifiedConfig = new UnifiedConfigManager(process.cwd());
    const unifiedConfigData = await unifiedConfig.loadConfig();

    // Check configured servers from .aship/servers.yml
    const configuredServer = unifiedConfigData.servers.servers.find(
      (s: any) => s.name === serverName
    );
    if (configuredServer) {
      return {
        host: configuredServer.hostname,
        port: configuredServer.port || 22,
        user: configuredServer.user,
        authType: 'key',
        authValue: configuredServer.identity_file || '~/.ssh/id_rsa',
      };
    }

    // Check saved hosts from HostManager (hosts.yml)
    try {
      const { HostManager, DirectoryManager } = await import('@aship/core');
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);
      const savedHost = await hostManager.getHost(serverName);
      if (savedHost) {
        return {
          host: savedHost.hostname,
          port: savedHost.port || 22,
          user: savedHost.user,
          authType: 'key',
          authValue: savedHost.identity_file || '~/.ssh/id_rsa',
        };
      }
    } catch (error) {
      logger.warn(
        `Failed to load saved host: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // Check inventory hosts
    if (serverName.startsWith('inventory:')) {
      const hostName = serverName.replace('inventory:', '');
      const inventoryHost = unifiedConfigData.inventoryHosts.find((h: any) => h.name === hostName);
      if (inventoryHost) {
        return {
          host: inventoryHost.host,
          port: inventoryHost.port || 22,
          user: inventoryHost.user || 'root',
          authType: 'key',
          authValue: '~/.ssh/id_rsa',
        };
      }
    }

    // Check recent connection
    if (serverName.startsWith('recent:')) {
      const hostName = serverName.replace('recent:', '');
      try {
        const { HostManager, DirectoryManager } = await import('@aship/core');
        const directoryManager = new DirectoryManager();
        const hostManager = new HostManager(directoryManager);
        const recent = await hostManager.getRecentConnection();

        if (recent && recent.host === hostName) {
          return {
            host: recent.host,
            port: recent.port || 22,
            user: recent.user || 'root',
            authType: recent.authType || 'key',
            authValue: recent.authValue || '~/.ssh/id_rsa',
          };
        }
      } catch (error) {
        logger.warn(
          `Failed to load recent connection: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    // Check connection history
    if (serverName.startsWith('history:')) {
      const parts = serverName.replace('history:', '').split(':');
      if (parts.length >= 2) {
        const [host, user] = parts;
        return {
          host: host,
          port: 22,
          user: user,
          authType: 'key',
          authValue: '~/.ssh/id_rsa',
        };
      }
    }
  } catch (error) {
    logger.warn(
      `Failed to load unified configuration: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Fallback: try to parse server name directly
  if (serverName.includes('@')) {
    // This is likely a connection in format "user@host"
    const [user, host] = serverName.split('@');
    return {
      host: host,
      port: 22,
      user: user,
      authType: 'key',
      authValue: '~/.ssh/id_rsa',
    };
  }

  // If serverName is just a hostname, return basic info
  if (serverName && !serverName.includes(':') && !serverName.includes('@')) {
    return {
      host: serverName,
      port: 22,
      user: 'root', // Default user
      authType: 'key',
      authValue: '~/.ssh/id_rsa',
    };
  }

  return null;
}

/**
 * Parse SSH connection string in format user@host:port
 * @param connectionString SSH connection string
 * @returns Parsed connection components
 */
function parseSSHConnectionString(connectionString: string): {
  user?: string;
  host: string;
  port?: number;
} {
  let user: string | undefined;
  let host: string;
  let port: number | undefined;

  // Check for user@host format
  if (connectionString.includes('@')) {
    const atIndex = connectionString.lastIndexOf('@');
    user = connectionString.substring(0, atIndex);
    host = connectionString.substring(atIndex + 1);
  } else {
    host = connectionString;
  }

  // Check for host:port format
  if (host.includes(':')) {
    const colonIndex = host.lastIndexOf(':');
    const portStr = host.substring(colonIndex + 1);
    const parsedPort = Number.parseInt(portStr, 10);

    if (!Number.isNaN(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
      port = parsedPort;
      host = host.substring(0, colonIndex);
    }
  }

  return { user, host, port };
}
