/**
 * Ansible executor for running Ansible commands
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AnsibleConfig, ExecutionResult, ServerConfig } from '../types/index.js';
import { fileExists } from '../utils/fs.js';
import { generateInventoryFile } from './inventory.js';

// Export dependencies for testing
const dependencies = {
  fs,
  spawn,
  path,
  fileExists,
  generateInventoryFile,
};

/**
 * Options for executing Ansible
 */
interface AnsibleExecuteOptions {
  /**
   * Target servers
   */
  servers: ServerConfig[];

  /**
   * Playbook path
   */
  playbook: string;

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
   * Event handlers
   */
  events?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    onProgress?: (progress: number) => void;
  };
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
  async executePlaybook(options: AnsibleExecuteOptions): Promise<ExecutionResult> {
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
      const args = this.buildAnsibleCommand(options, inventoryPath);

      // Execute command
      return await new Promise<ExecutionResult>(resolve => {
        let stdout = '';
        let stderr = '';

        const childProcess = dependencies.spawn('ansible-playbook', args, {
          cwd: options.cwd,
          env: {
            ...process.env,
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
   * Build Ansible command arguments
   * @param options Execution options
   * @param playbookPath Playbook path
   * @returns Command arguments
   */
  private buildAnsibleCommand(options: AnsibleExecuteOptions, inventoryPath: string): string[] {
    const args: string[] = [];

    // Add inventory
    args.push('-i');
    args.push(inventoryPath);

    // Add verbosity flag
    if (options.verbose && options.verbose > 0) {
      args.push(`-${'v'.repeat(Math.min(options.verbose, 4))}`);
    }

    // Add extra vars
    if (options.extraVars) {
      args.push('--extra-vars');
      args.push(JSON.stringify(options.extraVars));
    }

    // Add become flags
    args.push('--become');

    // Add playbook path
    args.push(options.playbook);

    return args;
  }
}

/**
 * Execute an Ansible playbook
 * @param options Execution options
 * @returns Execution result
 */
async function executeAnsiblePlaybook(options: AnsibleExecuteOptions): Promise<ExecutionResult> {
  const executor = new AnsibleExecutor();
  return executor.executePlaybook(options);
}

export { AnsibleExecutor, dependencies, executeAnsiblePlaybook };
