/**
 * Permission checking utilities
 */

import chalk from 'chalk';
import { SSHConnection } from '../ssh/connection.js';
import { PermissionLevel, checkPermissionLevel } from '../ssh/permissions.js';
import { logger } from '../utils/logger.js';
import type { PermissionCheckResult } from './types.js';

/**
 * Check user permissions on the remote server
 * @param sshConnection SSH connection to use
 * @returns Permission check result
 */
export async function checkUserPermissions(
  sshConnection: SSHConnection
): Promise<PermissionCheckResult> {
  try {
    console.log(chalk.blue('Verifying user permission level...'));
    const permissionLevel = await checkPermissionLevel(sshConnection);

    // Check if the user is in the sudo group
    try {
      // Get current username
      const whoamiResult = await sshConnection.exec('whoami');
      const currentUser = whoamiResult.stdout.trim();

      // Check user groups
      const groupResult = await sshConnection.exec('groups');
      const isInSudoGroup =
        groupResult.stdout.includes('sudo') ||
        groupResult.stdout.includes('wheel') ||
        groupResult.stdout.includes('admin');

      // Try to run a simple sudo command
      const sudoTest = await sshConnection.exec('sudo -n true 2>/dev/null');
      const canUseSudoWithoutPassword = sudoTest.exitCode === 0;

      // Try to check if the user is in the sudoers file
      const sudoersTest = await sshConnection.exec(
        `sudo -l -U ${currentUser} 2>&1 || echo "NotInSudoers"`
      );
      const isInSudoers =
        !sudoersTest.stdout.includes('NotInSudoers') &&
        !sudoersTest.stdout.includes('is not in the sudoers file') &&
        !sudoersTest.stderr.includes('is not in the sudoers file') &&
        !sudoersTest.stdout.includes('not in the sudoers file');

      // If the user is root, or in the sudo group, or in the sudoers file, or can use sudo without password, consider them to have sudo privileges
      const hasSudoPrivileges =
        permissionLevel === PermissionLevel.ROOT ||
        isInSudoGroup ||
        isInSudoers ||
        canUseSudoWithoutPassword;

      console.log(
        chalk.blue(
          `User sudo status: ${JSON.stringify(
            {
              permissionLevel,
              isInSudoGroup,
              isInSudoers,
              canUseSudoWithoutPassword,
              hasSudoPrivileges,
            },
            null,
            2
          )}`
        )
      );

      return {
        permissionLevel: hasSudoPrivileges ? PermissionLevel.SUDO : PermissionLevel.NORMAL,
        isInSudoGroup,
        isInSudoers,
        canUseSudoWithoutPassword,
        hasError: !hasSudoPrivileges,
      };
    } catch (error) {
      // 无法确定详细的权限信息
      console.log(
        chalk.yellow(
          `Error checking sudo permissions: ${error instanceof Error ? error.message : String(error)}`
        )
      );
      return {
        permissionLevel,
        hasError: true,
        errorMessage: error instanceof Error ? error.message : String(error),
      };
    }
  } catch (error) {
    return {
      permissionLevel: PermissionLevel.UNKNOWN,
      hasError: true,
      errorMessage: `Failed to check permission level: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Display permission check results
 * @param result Permission check result
 * @param username Current username
 * @returns Whether the user has sufficient privileges
 */
export function displayPermissionCheckResults(
  result: PermissionCheckResult,
  username: string
): boolean {
  if (result.permissionLevel === PermissionLevel.ROOT) {
    console.log(chalk.green('✓ Connected as root user with full privileges'));
    return true;
  }
  if (result.permissionLevel === PermissionLevel.SUDO) {
    console.log(chalk.green('✓ Connected as user with sudo privileges'));
    if (result.isInSudoGroup) {
      console.log(chalk.green('✓ User is a member of the sudo group'));
    }
    if (result.isInSudoers) {
      console.log(chalk.green('✓ User is in the sudoers file'));
    }
    if (result.canUseSudoWithoutPassword) {
      console.log(chalk.green('✓ User can use sudo without password'));
    } else {
      console.log(chalk.yellow('⚠ User requires password for sudo operations'));
    }
    return true;
  }
  // User does not have sufficient privileges
  if (result.permissionLevel === PermissionLevel.NORMAL) {
    console.log(chalk.red('✗ Error: Connected as user without sudo privileges'));

    if (result.isInSudoGroup === false) {
      console.log(chalk.red('✗ User is not a member of the sudo group'));
    }

    if (result.isInSudoers === false) {
      console.log(chalk.red('✗ User is not in the sudoers file'));
    }
  } else {
    console.log(chalk.red('✗ Error: Could not determine user privileges'));
    if (result.errorMessage) {
      console.log(chalk.red(`✗ Error details: ${result.errorMessage}`));
    }
  }
  console.log(chalk.red('This operation requires sudo privileges to continue'));

  // Display the command to add user to sudo group
  console.log(
    chalk.yellow('\nTo add this user to the sudo group, run this command on the server as root:')
  );
  console.log(chalk.bgBlue.white(`sudo usermod -aG sudo ${username}`));
  console.log(chalk.yellow('Or on some systems:'));
  console.log(chalk.bgBlue.white(`sudo usermod -aG wheel ${username}`));

  // Display the command to add user to sudoers file
  console.log(chalk.yellow('\nAlternatively, you can add this user to the sudoers file:'));
  console.log(
    chalk.bgBlue.white(`echo '${username} ALL=(ALL) ALL' | sudo tee /etc/sudoers.d/${username}`)
  );
  console.log(chalk.yellow('Or for passwordless sudo:'));
  console.log(
    chalk.bgBlue.white(
      `echo '${username} ALL=(ALL) NOPASSWD: ALL' | sudo tee /etc/sudoers.d/${username}`
    )
  );

  console.log(
    chalk.yellow(
      '\nAfter adding the user to the sudo group, you may need to log out and log back in for the changes to take effect.'
    )
  );

  return false;
}

/**
 * Verify user permissions and return authentication information
 * @param host Host to connect to
 * @param port Port to connect to
 * @param username Username to connect with
 * @param password Password for authentication (optional)
 * @param privateKey Private key for authentication (optional)
 * @param options Options for permission verification
 * @returns Connection result with authentication information
 */
export async function verifyUserPermissions(
  host: string,
  port: number,
  username: string,
  password?: string,
  privateKey?: string,
  options: { exitOnFailure?: boolean } = {}
): Promise<PermissionCheckResult & { success: boolean; authType?: string; authValue?: string }> {
  console.log(chalk.blue('Checking user sudo privileges...'));

  // Create a temporary SSH connection to check permissions
  const sshConnection = new SSHConnection();
  console.log(chalk.blue(`Connecting to ${host} as ${username}...`));

  try {
    // First try to connect using the provided credentials
    let connectResult = await sshConnection.connect({
      host,
      port,
      username,
      password,
      privateKey,
    });

    // Record the actual authentication method used
    let authType = password ? 'password' : 'key';
    let authValue = password || privateKey;

    // If connection fails, try other authentication methods
    let attempts = 1;
    const maxAttempts = 3;

    while (!connectResult.success && attempts < maxAttempts) {
      attempts++;

      // If it's a key issue or authentication failure, try using password
      if (
        connectResult.message.includes('privateKey') ||
        connectResult.message.includes('key format') ||
        connectResult.message.includes('Authentication failed')
      ) {
        // If no password or incorrect password, prompt the user to enter one
        console.log(
          chalk.yellow(
            `SSH key authentication failed. Please enter password (attempt ${attempts}/${maxAttempts}):`
          )
        );
        const inquirer = await import('inquirer');
        const { userPassword } = await inquirer.default.prompt([
          {
            type: 'password',
            name: 'userPassword',
            message: `Password for ${username}@${host}:`,
            mask: '*',
          },
        ]);

        // Retry connection using password
        connectResult = await sshConnection.connect({
          host,
          port,
          username,
          password: userPassword,
        });

        // If connection is successful, update authentication method
        if (connectResult.success) {
          authType = 'password';
          authValue = userPassword;
        }
      } else {
        // Other types of errors, possibly network issues, etc.
        console.log(chalk.yellow(`Connection failed: ${connectResult.message}`));

        const inquirer = await import('inquirer');
        const { retry } = await inquirer.default.prompt([
          {
            type: 'confirm',
            name: 'retry',
            message: `Retry connection? (Attempt ${attempts}/${maxAttempts})`,
            default: true,
          },
        ]);

        if (!retry) {
          console.log(chalk.yellow('Connection verification skipped by user.'));
          return {
            success: false,
            permissionLevel: PermissionLevel.UNKNOWN,
            hasError: true,
            errorMessage: 'Connection verification skipped by user',
          };
        }

        // Retry connection
        console.log(chalk.blue(`Retrying connection to ${host} as ${username}...`));
        connectResult = await sshConnection.connect({
          host,
          port,
          username,
          password,
          privateKey,
        });
      }
    }

    if (connectResult.success) {
      // Check user permission level
      const permissionResult = await checkUserPermissions(sshConnection);

      // Display the permission level result
      const hasSufficientPrivileges = displayPermissionCheckResults(permissionResult, username);

      // If user does not have sufficient privileges, ask if they want to continue
      if (!hasSufficientPrivileges) {
        const inquirer = await import('inquirer');
        const { continueWithoutSudo } = await inquirer.default.prompt([
          {
            type: 'confirm',
            name: 'continueWithoutSudo',
            message: 'Do you want to continue without sudo privileges? (The operation may fail)',
            default: true,
          },
        ]);

        if (!continueWithoutSudo) {
          console.log(chalk.yellow('Operation cancelled by user.'));
          if (options.exitOnFailure) {
            process.exit(0);
          }
          return {
            success: false,
            permissionLevel: PermissionLevel.UNKNOWN,
            hasError: true,
            errorMessage: 'Operation cancelled by user',
          };
        }

        console.log(
          chalk.yellow(
            'Continuing without sudo privileges. The command may fail if sudo is required.'
          )
        );
      }

      // Close the SSH connection
      sshConnection.disconnect();

      // Return connection success and authentication information, as well as permission check results
      return {
        success: true,
        authType,
        authValue,
        permissionLevel: permissionResult.permissionLevel,
        hasError: permissionResult.hasError,
        isInSudoGroup: permissionResult.isInSudoGroup,
        isInSudoers: permissionResult.isInSudoers,
        canUseSudoWithoutPassword: permissionResult.canUseSudoWithoutPassword,
      };
    }
    console.log(
      chalk.red(`✗ Error: Failed to connect for permission verification: ${connectResult.message}`)
    );
    console.log(
      chalk.yellow(
        "Continuing without permission verification. The command may fail if you don't have sufficient privileges."
      )
    );
    return {
      success: false,
      permissionLevel: PermissionLevel.UNKNOWN,
      hasError: true,
      errorMessage: `Failed to connect for permission verification: ${connectResult.message}`,
    };
  } catch (error) {
    logger.warn(
      `Failed to verify user permissions: ${error instanceof Error ? error.message : String(error)}`
    );
    logger.warn(
      "Continuing without permission verification. The command may fail if you don't have sufficient privileges."
    );
    return {
      success: false,
      permissionLevel: PermissionLevel.UNKNOWN,
      hasError: true,
      errorMessage: `Failed to verify user permissions: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
