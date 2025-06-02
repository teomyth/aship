/**
 * SSH connection class
 */

import chalk from 'chalk';
import inquirer from 'inquirer';
import { NodeSSH, type Config as SSHConfig } from 'node-ssh';
import { PermissionLevel, checkPermissionLevel, displayPermissionInfo } from './permissions.js';

/**
 * SSH connection result
 */
export interface SSHConnectionResult {
  /**
   * Connection success status
   */
  success: boolean;

  /**
   * Connection message
   */
  message: string;

  /**
   * Authentication method used
   */
  method?: string;

  /**
   * Username used for connection
   */
  user?: string;

  /**
   * SSH key path (if key authentication was used)
   */
  keyPath?: string;

  /**
   * Permission level of the connected user
   */
  permissionLevel?: PermissionLevel;
}

/**
 * SSH connection class
 * Wraps NodeSSH with additional functionality
 */
export class SSHConnection {
  /**
   * NodeSSH instance
   */
  private ssh: NodeSSH;

  /**
   * Connection options
   */
  private options: SSHConfig;

  /**
   * Permission level of the connected user
   */
  private permissionLevel: PermissionLevel = PermissionLevel.UNKNOWN;

  /**
   * Root connection (if available)
   */
  private rootConnection?: SSHConnection;

  /**
   * Constructor
   */
  constructor() {
    this.ssh = new NodeSSH();
    this.options = {};
  }

  /**
   * Connect to a server
   * @param options Connection options
   * @param timeout Connection timeout in milliseconds
   * @returns Connection result
   */
  async connect(options: SSHConfig, timeout = 10000): Promise<SSHConnectionResult> {
    this.options = options;

    try {
      // Try to connect with a timeout
      await Promise.race([
        this.ssh.connect(options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeout)
        ),
      ]);

      // Run a simple command to verify connection
      const result = await this.ssh.execCommand('echo "Connection successful"');

      // Determine authentication method used
      let method = 'unknown';
      if (options.privateKey) {
        method = 'key';
      } else if (options.password) {
        method = 'password';
      } else if (options.agent) {
        method = 'agent';
      }

      // Check permission level
      this.permissionLevel = await checkPermissionLevel(this);

      // Display permission information
      displayPermissionInfo(this.permissionLevel);

      return {
        success: true,
        message: result.stdout || 'Connection successful',
        method,
        user: options.username,
        keyPath: options.privateKey,
        permissionLevel: this.permissionLevel,
      };
    } catch (error) {
      return {
        success: false,
        message: (error as Error).message,
      };
    }
  }

  /**
   * Execute a command on the server
   * @param command Command to execute
   * @param options Command options
   * @returns Command result
   */
  async exec(
    command: string,
    options: { cwd?: string; asSudo?: boolean } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { cwd, asSudo = false } = options;

    // If asSudo is true and we're not root, prepend sudo
    const finalCommand =
      asSudo && this.permissionLevel !== PermissionLevel.ROOT ? `sudo ${command}` : command;

    try {
      const result = await this.ssh.execCommand(finalCommand, { cwd });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.code ?? 0, // Use 0 as default if code is null
      };
    } catch (error) {
      return {
        stdout: '',
        stderr: (error as Error).message,
        exitCode: 1,
      };
    }
  }

  /**
   * Check if the connection has sufficient permissions for an operation
   * @param requiredLevel Required permission level
   * @returns True if the connection has sufficient permissions
   */
  hasPermission(requiredLevel: PermissionLevel): boolean {
    if (requiredLevel === PermissionLevel.ROOT) {
      return this.permissionLevel === PermissionLevel.ROOT;
    }

    if (requiredLevel === PermissionLevel.SUDO) {
      return (
        this.permissionLevel === PermissionLevel.ROOT ||
        this.permissionLevel === PermissionLevel.SUDO
      );
    }

    return true;
  }

  /**
   * Get the permission level of the connected user
   * @returns Permission level
   */
  getPermissionLevel(): PermissionLevel {
    return this.permissionLevel;
  }

  /**
   * Set a root connection for operations that require root privileges
   * @param connection Root connection
   */
  setRootConnection(connection: SSHConnection): void {
    this.rootConnection = connection;
  }

  /**
   * Get the root connection if available
   * @returns Root connection or undefined
   */
  getRootConnection(): SSHConnection | undefined {
    return this.rootConnection;
  }

  /**
   * Execute a command with elevated privileges
   * If the current user doesn't have sufficient privileges,
   * use the root connection if available, or prompt for elevation
   * @param command Command to execute
   * @param options Command options
   * @returns Command result
   */
  async execWithElevation(
    command: string,
    options: { cwd?: string; requiredLevel?: PermissionLevel } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const { cwd, requiredLevel = PermissionLevel.SUDO } = options;

    // Check if we have sufficient permissions
    if (this.hasPermission(requiredLevel)) {
      return this.exec(command, { cwd, asSudo: requiredLevel !== PermissionLevel.NORMAL });
    }

    // If we have a root connection, use it
    if (this.rootConnection) {
      return this.rootConnection.exec(command, { cwd });
    }

    // Otherwise, prompt for elevation
    console.log(
      chalk.yellow(
        `⚠ This operation requires ${
          requiredLevel === PermissionLevel.ROOT ? 'root' : 'sudo'
        } privileges.`
      )
    );

    const { elevate } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'elevate',
        message: 'Do you want to provide credentials for a privileged account? [Y/n]',
        default: true,
      },
    ]);

    if (!elevate) {
      return {
        stdout: '',
        stderr: 'Operation cancelled: insufficient privileges',
        exitCode: 1,
      };
    }

    // Prompt for credentials
    const { username, password } = await inquirer.prompt([
      {
        type: 'input',
        name: 'username',
        message: 'Username:',
        default: 'root',
      },
      {
        type: 'password',
        name: 'password',
        message: 'Password:',
        mask: '*',
      },
    ]);

    // Create a temporary connection with the provided credentials
    const tempConnection = new SSHConnection();
    const connectResult = await tempConnection.connect({
      host: this.options.host,
      port: this.options.port,
      username,
      password,
    });

    if (!connectResult.success) {
      return {
        stdout: '',
        stderr: `Failed to connect with provided credentials: ${connectResult.message}`,
        exitCode: 1,
      };
    }

    // Check if the new connection has sufficient permissions
    if (!tempConnection.hasPermission(requiredLevel)) {
      return {
        stdout: '',
        stderr: `The provided account doesn't have ${
          requiredLevel === PermissionLevel.ROOT ? 'root' : 'sudo'
        } privileges`,
        exitCode: 1,
      };
    }

    // Execute the command with the temporary connection
    const result = await tempConnection.exec(command, { cwd });

    // Ask if the user wants to save this connection for future operations
    const { saveConnection } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'saveConnection',
        message: 'Do you want to save this connection for future privileged operations? [Y/n]',
        default: true,
      },
    ]);

    if (saveConnection) {
      this.setRootConnection(tempConnection);
    } else {
      // Dispose the temporary connection
      tempConnection.dispose();
    }

    return result;
  }

  /**
   * Close the connection
   */
  dispose(): void {
    try {
      this.ssh.dispose();
    } catch (_error) {
      // Ignore errors during disconnect
    }

    // Also dispose the root connection if available
    if (this.rootConnection) {
      this.rootConnection.dispose();
    }
  }

  /**
   * Disconnect from the server (alias for dispose)
   */
  disconnect(): void {
    this.dispose();
  }
}
