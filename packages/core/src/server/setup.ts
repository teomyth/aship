/**
 * Server setup utilities
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeSSH } from 'node-ssh';
import type { ServerConfig } from '../types/index.js';

/**
 * Server setup options
 */
export interface ServerSetupOptions {
  /**
   * Target user to set up
   */
  targetUser: string;

  /**
   * Create user if it doesn't exist
   */
  createUser?: boolean;

  /**
   * User password (for new user creation)
   */
  password?: string;

  /**
   * Set up sudo access for the user
   */
  setupSudo?: boolean;

  /**
   * Set up SSH key authentication
   */
  setupSshKey?: boolean;

  /**
   * SSH keys to add (paths, GitHub usernames, etc.)
   */
  sshKeys?: string[];

  /**
   * Disable root SSH login
   */
  disableRootLogin?: boolean;

  /**
   * Disable password authentication
   */
  disablePasswordAuth?: boolean;
}

/**
 * Setup result
 */
export interface SetupResult {
  /**
   * Whether the setup was successful
   */
  success: boolean;

  /**
   * Error message if setup failed
   */
  error?: string;

  /**
   * Steps that were completed successfully
   */
  completedSteps: string[];
}

/**
 * Set up a server for Ansible
 * @param server Server configuration
 * @param options Setup options
 * @returns Setup result
 */
export async function setupServer(
  server: ServerConfig,
  options: ServerSetupOptions
): Promise<SetupResult> {
  const result: SetupResult = {
    success: false,
    completedSteps: [],
  };

  try {
    // Connect to server
    const ssh = new NodeSSH();
    await ssh.connect({
      host: server.hostname,
      port: server.port,
      username: server.user,
      privateKey: server.identity_file,
    });

    // Check if target user exists
    const userExists = await checkUserExists(ssh, options.targetUser);

    // Create user if it doesn't exist
    if (!userExists && options.createUser) {
      await createUser(ssh, options.targetUser, options.password);
      result.completedSteps.push('user_created');
    } else if (!userExists && !options.createUser) {
      throw new Error(`User ${options.targetUser} does not exist and creation is disabled`);
    }

    // Set up sudo access
    if (options.setupSudo) {
      await setupSudoAccess(ssh, options.targetUser);
      result.completedSteps.push('sudo_configured');
    }

    // Set up SSH key authentication
    if (options.setupSshKey) {
      if (options.sshKeys && options.sshKeys.length > 0) {
        for (const keySource of options.sshKeys) {
          await addSshKey(ssh, options.targetUser, keySource);
        }
      } else {
        // Use default key
        const defaultKey = path.join(os.homedir(), '.ssh', 'id_rsa.pub');
        if (fs.existsSync(defaultKey)) {
          await addSshKey(ssh, options.targetUser, defaultKey);
        }
      }
      result.completedSteps.push('ssh_key_configured');
    }

    // Disable root login
    if (options.disableRootLogin) {
      await disableRootLogin(ssh);
      result.completedSteps.push('root_login_disabled');
    }

    // Disable password authentication
    if (options.disablePasswordAuth) {
      await disablePasswordAuth(ssh);
      result.completedSteps.push('password_auth_disabled');
    }

    // Close connection
    ssh.dispose();

    result.success = true;
    return result;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

/**
 * Check if a user exists on the server
 * @param ssh SSH connection
 * @param username Username to check
 * @returns Whether the user exists
 */
async function checkUserExists(ssh: NodeSSH, username: string): Promise<boolean> {
  const result = await ssh.execCommand(`id -u ${username} 2>/dev/null || echo "not found"`);
  return !result.stdout.includes('not found');
}

/**
 * Create a new user on the server
 * @param ssh SSH connection
 * @param username Username to create
 * @param password Password for the new user
 */
async function createUser(ssh: NodeSSH, username: string, password?: string): Promise<void> {
  // Create user
  await ssh.execCommand(`useradd -m -s /bin/bash ${username}`);

  // Set password if provided
  if (password) {
    await ssh.execCommand(`echo "${username}:${password}" | chpasswd`);
  }
}

/**
 * Set up sudo access for a user
 * @param ssh SSH connection
 * @param username Username to set up sudo for
 */
async function setupSudoAccess(ssh: NodeSSH, username: string): Promise<void> {
  // Check if user already has sudo access
  const sudoCheckResult = await ssh.execCommand(
    `sudo -l -U ${username} 2>&1 | grep -q "ALL" && echo "has_sudo" || echo "no_sudo"`
  );

  if (sudoCheckResult.stdout.includes('has_sudo')) {
    return; // User already has sudo access
  }

  // Add user to sudo group
  await ssh.execCommand(`usermod -aG sudo ${username}`);

  // Create sudoers file for user
  await ssh.execCommand(`echo "${username} ALL=(ALL) ALL" > /etc/sudoers.d/${username}`);
  await ssh.execCommand(`chmod 440 /etc/sudoers.d/${username}`);
}

/**
 * Add SSH key to authorized_keys for a user
 * @param ssh SSH connection
 * @param username Username to add key for
 * @param keySource Key source (file path, GitHub username, etc.)
 */
async function addSshKey(ssh: NodeSSH, username: string, keySource: string): Promise<void> {
  let keyContent = '';

  // Handle different key sources
  if (keySource.startsWith('github:')) {
    // GitHub import
    const githubUser = keySource.substring(7);
    const response = await fetch(`https://github.com/${githubUser}.keys`);
    if (!response.ok) {
      throw new Error(`Failed to fetch keys from GitHub for user ${githubUser}`);
    }
    keyContent = await response.text();
  } else if (keySource.startsWith('gitlab:')) {
    // GitLab import
    const gitlabUser = keySource.substring(7);
    const response = await fetch(`https://gitlab.com/${gitlabUser}.keys`);
    if (!response.ok) {
      throw new Error(`Failed to fetch keys from GitLab for user ${gitlabUser}`);
    }
    keyContent = await response.text();
  } else {
    // Assume it's a local file
    let keyPath = keySource;

    // If it's a simple filename, look in ~/.ssh
    if (!keyPath.includes('/') && !keyPath.includes('\\')) {
      keyPath = path.join(os.homedir(), '.ssh', keyPath);
    }

    // Ensure it has .pub extension
    if (!keyPath.endsWith('.pub')) {
      keyPath = `${keyPath}.pub`;
    }

    // Read key file
    keyContent = fs.readFileSync(keyPath, 'utf8');
  }

  // Create .ssh directory if it doesn't exist
  await ssh.execCommand(`mkdir -p /home/${username}/.ssh`);

  // Add key to authorized_keys
  for (const key of keyContent.split('\n').filter(k => k.trim())) {
    await ssh.execCommand(`echo "${key}" >> /home/${username}/.ssh/authorized_keys`);
  }

  // Set proper permissions
  await ssh.execCommand(`chown -R ${username}:${username} /home/${username}/.ssh`);
  await ssh.execCommand(`chmod 700 /home/${username}/.ssh`);
  await ssh.execCommand(`chmod 600 /home/${username}/.ssh/authorized_keys`);
}

/**
 * Disable root SSH login
 * @param ssh SSH connection
 */
async function disableRootLogin(ssh: NodeSSH): Promise<void> {
  // Modify SSH config
  await ssh.execCommand(
    `sed -i 's/^#\\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config`
  );

  // Restart SSH service
  await ssh.execCommand('systemctl restart sshd');
}

/**
 * Disable password authentication
 * @param ssh SSH connection
 */
async function disablePasswordAuth(ssh: NodeSSH): Promise<void> {
  // Modify SSH config
  await ssh.execCommand(
    `sed -i 's/^#\\?PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config`
  );

  // Restart SSH service
  await ssh.execCommand('systemctl restart sshd');
}
