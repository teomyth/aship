/**
 * Ansible runner for executing playbooks
 */

import * as path from 'node:path';
import { execa } from 'execa';
import type { AnsibleConfig, ExecutionResult, ServerConfig } from '../types/index.js';
import { fileExists } from '../utils/fs.js';

/**
 * Ansible runner options
 */
interface AnsibleRunnerOptions {
  /**
   * Working directory
   */
  cwd?: string;

  /**
   * Ansible configuration
   */
  config?: AnsibleConfig;

  /**
   * Extra environment variables
   */
  env?: Record<string, string>;
}

/**
 * Ansible runner class
 */
class AnsibleRunner {
  /**
   * Options for running Ansible
   */
  private options: AnsibleRunnerOptions;

  /**
   * Constructor
   * @param options Options for running Ansible
   */
  constructor(options: AnsibleRunnerOptions = {}) {
    this.options = options;
  }

  /**
   * Run an Ansible playbook
   * @param playbookPath Path to the playbook
   * @param server Target server
   * @param extraVars Extra variables to pass to Ansible
   * @returns Execution result
   */
  async runPlaybook(
    playbookPath: string,
    server: ServerConfig,
    extraVars: Record<string, any> = {}
  ): Promise<ExecutionResult> {
    // Verify playbook exists
    if (!fileExists(playbookPath)) {
      return {
        success: false,
        exitCode: 1,
        stderr: `Playbook not found: ${playbookPath}`,
      };
    }

    // Prepare environment
    const env = this.prepareEnvironment();

    // Prepare command arguments
    const args = this.preparePlaybookArguments(playbookPath, server, extraVars);

    // Execute command
    const startTime = Date.now();
    try {
      const result = await execa('ansible-playbook', args, {
        env,
        cwd: this.options.cwd || path.dirname(playbookPath),
        reject: false,
      });

      const executionTime = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode ?? 1,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      return {
        success: false,
        exitCode: 1,
        stderr: (error as Error).message,
        executionTime,
      };
    }
  }

  /**
   * Prepare environment variables for Ansible
   * @returns Environment variables
   */
  private prepareEnvironment(): Record<string, string> {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ...this.options.env,
    };

    // Add ansible.cfg path if specified
    if (this.options.config?.configPath) {
      env.ANSIBLE_CONFIG = this.options.config.configPath;
    }

    return env;
  }

  /**
   * Prepare arguments for running a playbook
   * @param playbookPath Path to the playbook
   * @param server Target server
   * @param extraVars Extra variables to pass to Ansible
   * @returns Command-line arguments
   */
  private preparePlaybookArguments(
    playbookPath: string,
    server: ServerConfig,
    extraVars: Record<string, any>
  ): string[] {
    const args: string[] = [playbookPath];

    // Create a host specification
    args.push('-i', `${server.hostname},`);

    // Add host-specific arguments
    args.push('-u', server.user);

    // Add port
    if (server.port && server.port !== 22) {
      args.push('--port', server.port.toString());
    }

    // Add authentication
    if (server.identity_file) {
      args.push('--private-key', server.identity_file);
    }
    // For password authentication, we use environment variables
    // This is handled in the execution environment setup

    // Add extra variables
    const allExtraVars = {
      ...extraVars,
      ...server.variables,
    };

    if (Object.keys(allExtraVars).length > 0) {
      args.push('--extra-vars', JSON.stringify(allExtraVars));
    }

    // Add verbosity
    args.push('-v');

    return args;
  }
}

export { AnsibleRunner };
