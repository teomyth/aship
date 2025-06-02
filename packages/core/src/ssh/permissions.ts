/**
 * Functions for checking user permissions on remote servers
 */

import chalk from 'chalk';
import { SSHConnection } from './connection.js';

/**
 * User permission level
 */
export enum PermissionLevel {
  /**
   * User is root
   */
  ROOT = 'root',

  /**
   * User has sudo privileges
   */
  SUDO = 'sudo',

  /**
   * User has no elevated privileges
   */
  NORMAL = 'normal',

  /**
   * Permission level could not be determined
   */
  UNKNOWN = 'unknown',
}

/**
 * Check if the user is root
 * @param connection SSH connection
 * @returns True if the user is root
 */
export async function isRoot(connection: SSHConnection): Promise<boolean> {
  try {
    const result = await connection.exec('id -u');
    return result.stdout.trim() === '0';
  } catch (error) {
    console.error('Error checking if user is root:', error);
    return false;
  }
}

/**
 * Check if the user has sudo privileges
 * @param connection SSH connection
 * @returns True if the user has sudo privileges
 */
export async function hasSudo(connection: SSHConnection): Promise<boolean> {
  try {
    // Try to run a simple command with sudo without password
    const result = await connection.exec('sudo -n true 2>/dev/null');
    return result.exitCode === 0;
  } catch (_error) {
    // If the command fails, the user might still have sudo but requires password
    try {
      // Check if user is in sudo group
      const groupResult = await connection.exec('groups');
      return (
        groupResult.stdout.includes('sudo') ||
        groupResult.stdout.includes('wheel') ||
        groupResult.stdout.includes('admin')
      );
    } catch (innerError) {
      console.error('Error checking sudo privileges:', innerError);
      return false;
    }
  }
}

/**
 * Check the permission level of the current user
 * @param connection SSH connection
 * @returns Permission level
 */
export async function checkPermissionLevel(connection: SSHConnection): Promise<PermissionLevel> {
  try {
    if (await isRoot(connection)) {
      return PermissionLevel.ROOT;
    }

    if (await hasSudo(connection)) {
      return PermissionLevel.SUDO;
    }

    return PermissionLevel.NORMAL;
  } catch (error) {
    console.error('Error checking permission level:', error);
    return PermissionLevel.UNKNOWN;
  }
}

/**
 * Check if a user exists on the remote system
 * @param connection SSH connection
 * @param username Username to check
 * @returns True if the user exists
 */
export async function userExists(connection: SSHConnection, username: string): Promise<boolean> {
  try {
    const result = await connection.exec(`id -u ${username} 2>/dev/null || echo "not_found"`);
    return !result.stdout.includes('not_found');
  } catch (error) {
    console.error(`Error checking if user ${username} exists:`, error);
    return false;
  }
}

/**
 * Create a user on the remote system
 * @param connection SSH connection
 * @param username Username to create
 * @param options Options for user creation
 * @returns True if the user was created successfully
 */
export async function createUser(
  connection: SSHConnection,
  username: string,
  options: {
    addToSudo?: boolean;
    shell?: string;
    createHome?: boolean;
  } = {}
): Promise<boolean> {
  const { addToSudo = true, shell = '/bin/bash', createHome = true } = options;

  try {
    // Check if we have permission to create users
    const permLevel = await checkPermissionLevel(connection);
    if (permLevel !== PermissionLevel.ROOT && permLevel !== PermissionLevel.SUDO) {
      console.error('Insufficient permissions to create user');
      return false;
    }

    // Create the user
    let command = 'useradd';
    if (createHome) command += ' -m';
    if (shell) command += ` -s ${shell}`;
    command += ` ${username}`;

    const result = await connection.exec(`sudo ${command}`);
    if (result.exitCode !== 0) {
      console.error(`Failed to create user ${username}:`, result.stderr);
      return false;
    }

    // Add to sudo group if requested
    if (addToSudo) {
      // Different distributions use different sudo group names
      const sudoGroups = ['sudo', 'wheel', 'admin'];
      let addedToSudo = false;

      for (const group of sudoGroups) {
        try {
          // Check if the group exists
          const groupExists = await connection.exec(`getent group ${group}`);
          if (groupExists.exitCode === 0) {
            // Add user to the group
            const addResult = await connection.exec(`sudo usermod -aG ${group} ${username}`);
            if (addResult.exitCode === 0) {
              addedToSudo = true;
              break;
            }
          }
        } catch (error) {
          console.error(`Error adding user to ${group} group:`, error);
        }
      }

      if (!addedToSudo) {
        console.warn(`Could not add user ${username} to sudo group`);
      }
    }

    return true;
  } catch (error) {
    console.error(`Error creating user ${username}:`, error);
    return false;
  }
}

/**
 * Add a user to the sudo group
 * @param connection SSH connection
 * @param username Username to add to sudo group
 * @returns True if the user was added to sudo group successfully
 */
export async function addUserToSudo(connection: SSHConnection, username: string): Promise<boolean> {
  try {
    // Check if we have permission to modify users
    const permLevel = await checkPermissionLevel(connection);
    if (permLevel !== PermissionLevel.ROOT && permLevel !== PermissionLevel.SUDO) {
      console.error('Insufficient permissions to add user to sudo group');
      return false;
    }

    // Different distributions use different sudo group names
    const sudoGroups = ['sudo', 'wheel', 'admin'];
    let addedToSudo = false;

    for (const group of sudoGroups) {
      try {
        // Check if the group exists
        const groupExists = await connection.exec(`getent group ${group}`);
        if (groupExists.exitCode === 0) {
          // Add user to the group
          const addResult = await connection.exec(`sudo usermod -aG ${group} ${username}`);
          if (addResult.exitCode === 0) {
            addedToSudo = true;
            break;
          }
        }
      } catch (error) {
        console.error(`Error adding user to ${group} group:`, error);
      }
    }

    return addedToSudo;
  } catch (error) {
    console.error(`Error adding user ${username} to sudo group:`, error);
    return false;
  }
}

/**
 * Display permission information to the user
 * @param permLevel Permission level
 */
export function displayPermissionInfo(permLevel: PermissionLevel): void {
  switch (permLevel) {
    case PermissionLevel.ROOT:
      console.log(chalk.green('✓ Connected as root user with full privileges'));
      break;
    case PermissionLevel.SUDO:
      console.log(chalk.green('✓ Connected as user with sudo privileges'));
      break;
    case PermissionLevel.NORMAL:
      console.log(chalk.yellow('⚠ Connected as user without sudo privileges'));
      console.log(chalk.yellow('  Some operations may require elevated privileges'));
      break;
    case PermissionLevel.UNKNOWN:
      console.log(chalk.yellow('⚠ Could not determine user privileges'));
      console.log(chalk.yellow('  Some operations may fail'));
      break;
  }
}

/**
 * Set up SSH key authentication for a user
 * @param connection SSH connection with root or sudo privileges
 * @param username Username to set up SSH key authentication for
 * @param publicKeyPath Path to the public key file (default: ~/.ssh/id_rsa.pub)
 * @returns True if the key was set up successfully
 */
export async function setupSshKeyAuth(
  connection: SSHConnection,
  username: string,
  publicKeyPath?: string
): Promise<boolean> {
  try {
    // Check if we have permission to modify user files
    const permLevel = await checkPermissionLevel(connection);
    if (permLevel !== PermissionLevel.ROOT && permLevel !== PermissionLevel.SUDO) {
      console.error('Insufficient permissions to set up SSH key authentication');
      return false;
    }

    // Use default key path if not provided
    const keyPath = publicKeyPath || `${process.env.HOME}/.ssh/id_rsa.pub`;

    // Check if the key file exists locally
    const fs = await import('node:fs/promises');
    try {
      const keyContent = await fs.readFile(keyPath, 'utf8');
      if (!keyContent.trim()) {
        console.error('SSH public key is empty');
        return false;
      }

      console.log(chalk.blue(`Setting up SSH key authentication for ${username}...`));

      // Create .ssh directory if it doesn't exist
      await connection.exec(`sudo mkdir -p /home/${username}/.ssh`);

      // Add the key to authorized_keys (escape double quotes in the key content)
      const escapedKeyContent = keyContent.trim().replace(/"/g, '\\"');
      await connection.exec(
        `sudo bash -c 'echo "${escapedKeyContent}" >> /home/${username}/.ssh/authorized_keys'`
      );

      // Set correct permissions
      await connection.exec(`sudo chmod 700 /home/${username}/.ssh`);
      await connection.exec(`sudo chmod 600 /home/${username}/.ssh/authorized_keys`);
      await connection.exec(`sudo chown -R ${username}:${username} /home/${username}/.ssh`);

      console.log(chalk.green(`SSH key authentication set up successfully for ${username}`));
      return true;
    } catch (error) {
      console.error(`Error reading SSH key from ${keyPath}:`, error);
      return false;
    }
  } catch (error) {
    console.error(`Error setting up SSH key authentication for ${username}:`, error);
    return false;
  }
}

/**
 * Elevate user permissions using a root account
 * @param host Host to connect to
 * @param port Port to connect to
 * @param rootUsername Root username
 * @param rootPassword Root password
 * @param targetUsername Username to elevate
 * @param setupSshKey Whether to set up SSH key authentication
 * @returns True if the operation was successful
 */
export async function elevateUserPermissions(
  host: string,
  port: number,
  rootUsername: string,
  rootPassword: string,
  targetUsername: string,
  setupSshKey = true
): Promise<boolean> {
  // Create a new SSH connection as root
  const rootConnection = new SSHConnection();

  try {
    console.log(
      chalk.blue(`Connecting as ${rootUsername} to elevate permissions for ${targetUsername}...`)
    );

    // Connect as root
    const connectResult = await rootConnection.connect({
      host,
      port,
      username: rootUsername,
      password: rootPassword,
    });

    if (!connectResult.success) {
      console.error(chalk.red(`Failed to connect as ${rootUsername}: ${connectResult.message}`));
      return false;
    }

    console.log(
      chalk.blue(`Connected as ${rootUsername}. Adding ${targetUsername} to sudo group...`)
    );

    // Add user to sudo group
    const sudoResult = await addUserToSudo(rootConnection, targetUsername);
    if (!sudoResult) {
      console.error(chalk.red(`Failed to add user ${targetUsername} to sudo group`));
      return false;
    }

    console.log(chalk.green(`User ${targetUsername} added to sudo group successfully.`));

    // Set up SSH key authentication if requested
    if (setupSshKey) {
      console.log(chalk.blue(`Setting up SSH key authentication for ${targetUsername}...`));
      const sshKeyResult = await setupSshKeyAuth(rootConnection, targetUsername);
      if (!sshKeyResult) {
        console.warn(chalk.yellow(`Failed to set up SSH key authentication for ${targetUsername}`));
        // Continue anyway, this is not critical
      }
    }

    return true;
  } catch (error) {
    console.error(chalk.red('Error elevating user permissions:'), error);
    return false;
  } finally {
    // Close the SSH connection
    rootConnection.dispose();
  }
}
