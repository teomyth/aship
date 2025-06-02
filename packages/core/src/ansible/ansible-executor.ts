/**
 * Ansible executor
 *
 * This module provides functionality for executing Ansible commands (both ansible and ansible-playbook).
 * It handles inventory generation, command execution, and cleanup.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AnsibleConfig, ExecutionResult, ServerConfig } from '../types/index.js';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { generateInventoryFile } from './inventory.js';
import { filterAshipSpecificArgs, validateAnsibleArgs } from './utils.js';

/**
 * Generate a temporary variables file
 * @param variables Variables to write to file
 * @returns Path to the temporary variables file
 */
async function generateVariablesFile(variables: Record<string, any>): Promise<string> {
  // Create temporary file
  const tempFile = path.join(os.tmpdir(), `aship-vars-${Date.now()}.yml`);

  // Convert variables to YAML format
  const yamlContent = Object.entries(variables)
    .map(([key, value]) => {
      // Handle different value types
      if (typeof value === 'string') {
        // Escape quotes and handle multiline strings
        const escapedValue = value.includes('\n')
          ? `|\n  ${value.split('\n').join('\n  ')}`
          : `"${value.replace(/"/g, '\\"')}"`;
        return `${key}: ${escapedValue}`;
      }
      if (typeof value === 'boolean') {
        return `${key}: ${value}`;
      }
      if (typeof value === 'number') {
        return `${key}: ${value}`;
      }
      if (Array.isArray(value)) {
        return `${key}:\n${value.map(item => `  - ${JSON.stringify(item)}`).join('\n')}`;
      }
      if (typeof value === 'object' && value !== null) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join('\n');

  // Write to file
  await fs.writeFile(tempFile, yamlContent, 'utf-8');

  return tempFile;
}

// Export dependencies for testing
const dependencies = {
  fs,
  spawn,
  path,
  fileExists,
  generateInventoryFile,
  generateVariablesFile,
};

/**
 * Base options for executing Ansible commands
 */
interface AnsibleBaseOptions {
  /**
   * Target servers
   */
  servers: ServerConfig[];

  /**
   * Ansible configuration
   */
  ansibleConfig?: AnsibleConfig;

  /**
   * Extra variables
   */
  extraVars?: Record<string, any>;

  /**
   * Verbosity level (0-4)
   */
  verbose?: number;

  /**
   * Directory to execute the command in
   */
  cwd?: string;

  /**
   * Additional Ansible arguments
   */
  ansibleArgs?: string[];

  /**
   * Event handlers
   */
  events?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onProgress?: (progress: number) => void;
  };
}

/**
 * Options for executing Ansible playbook
 */
interface AnsiblePlaybookOptions extends AnsibleBaseOptions {
  /**
   * Playbook path
   */
  playbook: string;

  /**
   * Custom inventory path (optional)
   * If not provided, inventory will be generated from servers
   */
  inventoryPath?: string;
}

/**
 * Options for executing Ansible command
 */
interface AnsibleCommandOptions extends AnsibleBaseOptions {
  /**
   * Host pattern
   */
  pattern: string;

  /**
   * Module name
   */
  module: string;

  /**
   * Module arguments
   */
  args?: string;
}

/**
 * Ansible executor class
 */
class AnsibleExecutor {
  /**
   * Execute an Ansible playbook
   * @param options Execution options
   * @returns Execution result
   */
  async executePlaybook(options: AnsiblePlaybookOptions): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Validate options
    if (!options.servers || options.servers.length === 0) {
      return {
        success: false,
        exitCode: 1,
        stderr: 'No target servers specified',
        executionTime: 0,
      };
    }

    if (!options.playbook) {
      return {
        success: false,
        exitCode: 1,
        stderr: 'No playbook specified',
        executionTime: 0,
      };
    }

    const playbookPath = options.cwd
      ? path.resolve(options.cwd, options.playbook)
      : path.resolve(options.playbook);

    if (!dependencies.fileExists(playbookPath)) {
      return {
        success: false,
        exitCode: 1,
        stderr: `Playbook not found: ${options.playbook}`,
        executionTime: 0,
      };
    }

    // Use custom inventory or generate one
    let inventoryPath: string;
    let shouldCleanupInventory = false;

    if (options.inventoryPath) {
      // Use provided inventory path
      inventoryPath = options.inventoryPath;
    } else {
      // Generate inventory file from servers
      try {
        inventoryPath = await dependencies.generateInventoryFile(options.servers);
        shouldCleanupInventory = true;
      } catch (error) {
        return {
          success: false,
          exitCode: 1,
          stderr: `Failed to generate inventory file: ${(error as Error).message}`,
          executionTime: Date.now() - startTime,
        };
      }
    }

    // Generate variables file if needed
    let variablesPath: string | undefined;
    try {
      if (options.extraVars && Object.keys(options.extraVars).length > 0) {
        variablesPath = await dependencies.generateVariablesFile(options.extraVars);
      }
    } catch (error) {
      // Clean up inventory file before returning
      try {
        await dependencies.fs.unlink(inventoryPath);
      } catch {
        // Ignore cleanup errors
      }
      return {
        success: false,
        exitCode: 1,
        stderr: `Failed to generate variables file: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Build command arguments
      const args = this.buildPlaybookArgs(options, inventoryPath, variablesPath);

      // Set up environment variables for password authentication
      const env: Record<string, string> = {
        // Disable host key checking
        ANSIBLE_HOST_KEY_CHECKING: 'False',
        // Disable SSH key checking
        ANSIBLE_SSH_ARGS: '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
      };

      // Password authentication is handled through session password manager
      // Environment variables are set by the inventory generation process

      // Execute command
      return await this.executeCommand('ansible-playbook', args, {
        cwd: options.cwd,
        env,
        events: options.events,
      });
    } finally {
      // Clean up temporary files (only if we generated them)
      if (shouldCleanupInventory) {
        try {
          await dependencies.fs.unlink(inventoryPath);
        } catch (error) {
          // Ignore errors during cleanup
          console.warn(`Failed to remove temporary inventory file: ${(error as Error).message}`);
        }
      }

      if (variablesPath) {
        try {
          await dependencies.fs.unlink(variablesPath);
        } catch (error) {
          // Ignore errors during cleanup
          console.warn(`Failed to remove temporary variables file: ${(error as Error).message}`);
        }
      }
    }
  }

  /**
   * Execute an Ansible command
   * @param options Execution options
   * @returns Execution result
   */
  async executeAnsible(options: AnsibleCommandOptions): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Validate options
    if (!options.servers || options.servers.length === 0) {
      return {
        success: false,
        exitCode: 1,
        stderr: 'No target servers specified',
        executionTime: 0,
      };
    }

    if (!options.module) {
      return {
        success: false,
        exitCode: 1,
        stderr: 'No module specified',
        executionTime: 0,
      };
    }

    // Generate inventory file
    let inventoryPath: string;
    try {
      inventoryPath = await dependencies.generateInventoryFile(options.servers);
    } catch (error) {
      return {
        success: false,
        exitCode: 1,
        stderr: `Failed to generate inventory file: ${(error as Error).message}`,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      // Build command arguments
      const args = this.buildAnsibleArgs(options, inventoryPath);

      // Set up environment variables for password authentication
      const env: Record<string, string> = {
        // Disable host key checking
        ANSIBLE_HOST_KEY_CHECKING: 'False',
        // Disable SSH key checking
        ANSIBLE_SSH_ARGS: '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
      };

      // Password authentication is handled through session password manager
      // Environment variables are set by the inventory generation process

      // Execute command
      return await this.executeCommand('ansible', args, {
        cwd: options.cwd,
        env,
        events: options.events,
      });
    } finally {
      // Clean up inventory file
      try {
        await dependencies.fs.unlink(inventoryPath);
      } catch (error) {
        // Ignore errors during cleanup
        console.warn(`Failed to remove temporary inventory file: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Execute a command with the given arguments
   * @param command Command to execute
   * @param args Command arguments
   * @param options Execution options
   * @returns Execution result
   */
  private async executeCommand(
    command: string,
    args: string[],
    options: {
      cwd?: string;
      env?: Record<string, string>;
      events?: {
        onStdout?: (data: string) => void;
        onStderr?: (data: string) => void;
      };
    }
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Log the actual command being executed for debugging (only in debug/verbose mode)
    const isDebugMode =
      process.env.DEBUG ||
      process.env.NODE_ENV === 'development' ||
      args.some(arg => arg.startsWith('-v'));

    if (isDebugMode && options.events?.onStdout) {
      const commandLine = `${command} ${args.join(' ')}`;
      options.events.onStdout(`[DEBUG] Executing: ${commandLine}\n`);

      // Log environment variables being set (without sensitive values)
      if (options.env && Object.keys(options.env).length > 0) {
        options.events.onStdout('[DEBUG] Environment variables set:\n');
        for (const [key, value] of Object.entries(options.env)) {
          const displayValue = key.includes('PASS') ? '***MASKED***' : value;
          options.events.onStdout(`[DEBUG]   ${key}=${displayValue}\n`);
        }
      }
      options.events.onStdout(`${'[DEBUG] ─'.repeat(25)}\n`);
    }

    return await new Promise<ExecutionResult>(resolve => {
      let stdout = '';
      let stderr = '';

      const childProcess = dependencies.spawn(command, args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          ...(options.env || {}),
        },
      });

      childProcess.stdout.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        stdout += dataStr;
        if (options.events?.onStdout) {
          options.events.onStdout(dataStr);
        }
      });

      childProcess.stderr.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        stderr += dataStr;
        if (options.events?.onStderr) {
          options.events.onStderr(dataStr);
        }
      });

      childProcess.on('close', (exitCode: number | null) => {
        const executionTime = Date.now() - startTime;
        resolve({
          success: exitCode === 0,
          exitCode: exitCode || 0,
          stdout,
          stderr,
          executionTime,
        });
      });
    });
  }

  /**
   * Build Ansible playbook command arguments
   * @param options Execution options
   * @param inventoryPath Path to inventory file
   * @param variablesPath Optional path to variables file
   * @returns Command arguments
   */
  private buildPlaybookArgs(
    options: AnsiblePlaybookOptions,
    inventoryPath: string,
    variablesPath?: string
  ): string[] {
    const args: string[] = [];

    // Add inventory
    args.push('-i');
    args.push(inventoryPath);

    // Add verbosity flag
    if (options.verbose && options.verbose > 0) {
      args.push(`-${'v'.repeat(Math.min(options.verbose, 4))}`);
    }

    // Add extra vars - prefer variables file over JSON string
    if (variablesPath) {
      args.push('--extra-vars');
      args.push(`@${variablesPath}`);
    } else if (options.extraVars && Object.keys(options.extraVars).length > 0) {
      args.push('--extra-vars');
      args.push(JSON.stringify(options.extraVars));
    }

    // Add become flags
    args.push('--become');

    // Add additional Ansible arguments with validation
    if (options.ansibleArgs && options.ansibleArgs.length > 0) {
      // First filter out aship-specific arguments
      const filteredArgs = filterAshipSpecificArgs(options.ansibleArgs);

      // Then validate the remaining arguments
      const { validArgs, warnings } = validateAnsibleArgs(filteredArgs);

      // Log warnings for invalid parameters
      if (warnings.length > 0) {
        warnings.forEach(warning => {
          logger.warn(`Ansible parameter validation: ${warning}`);
        });
      }

      args.push(...validArgs);
    }

    // Add playbook path
    args.push(options.playbook);

    return args;
  }

  /**
   * Build Ansible command arguments
   * @param options Execution options
   * @param inventoryPath Path to inventory file
   * @returns Command arguments
   */
  private buildAnsibleArgs(options: AnsibleCommandOptions, inventoryPath: string): string[] {
    const args: string[] = [];

    // Add inventory
    args.push('-i');
    args.push(inventoryPath);

    // Add verbosity flag
    if (options.verbose && options.verbose > 0) {
      args.push(`-${'v'.repeat(Math.min(options.verbose, 4))}`);
    }

    // Add module
    args.push('-m');
    args.push(options.module);

    // Add module arguments if provided
    if (options.args) {
      args.push('-a');
      args.push(options.args);
    }

    // Add extra vars
    if (options.extraVars) {
      args.push('--extra-vars');
      args.push(JSON.stringify(options.extraVars));
    }

    // Add become flags
    args.push('--become');

    // Add additional Ansible arguments with validation
    if (options.ansibleArgs && options.ansibleArgs.length > 0) {
      // First filter out aship-specific arguments
      const filteredArgs = filterAshipSpecificArgs(options.ansibleArgs);

      // Then validate the remaining arguments
      const { validArgs, warnings } = validateAnsibleArgs(filteredArgs);

      // Log warnings for invalid parameters
      if (warnings.length > 0) {
        warnings.forEach(warning => {
          logger.warn(`Ansible parameter validation: ${warning}`);
        });
      }

      args.push(...validArgs);
    }

    // Add host pattern
    args.push(options.pattern);

    return args;
  }
}

/**
 * Execute an Ansible playbook
 * @param options Execution options
 * @returns Execution result
 */
async function executeAnsiblePlaybook(options: AnsiblePlaybookOptions): Promise<ExecutionResult> {
  const executor = new AnsibleExecutor();
  return executor.executePlaybook(options);
}

/**
 * Execute an Ansible command
 * @param options Execution options
 * @returns Execution result
 */
async function executeAnsibleCommand(options: AnsibleCommandOptions): Promise<ExecutionResult> {
  const executor = new AnsibleExecutor();
  return executor.executeAnsible(options);
}

export {
  AnsibleExecutor,
  dependencies,
  executeAnsiblePlaybook,
  executeAnsibleCommand,
  type AnsiblePlaybookOptions,
  type AnsibleCommandOptions,
  type AnsibleBaseOptions,
};
