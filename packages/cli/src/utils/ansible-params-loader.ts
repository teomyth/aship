import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Command } from 'commander';

// Method to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ansible parameter definition interface
 */
export interface AnsibleParam {
  flag: string;
  description: string;
  source: string; // Parameter source, e.g., 'ansible-playbook', 'ansible', etc.
}

/**
 * Load common Ansible parameter definitions
 * @returns Array of parameter definitions
 */
export function loadCommonAnsibleParams(): AnsibleParam[] {
  // Hardcoded common Ansible parameters to avoid configuration file path issues
  return [
    // Tag-related
    {
      flag: '-t, --tags <tags>',
      description: 'only run plays and tasks tagged with these values',
      source: 'ansible-playbook',
    },
    {
      flag: '--skip-tags <tags>',
      description: 'only run plays and tasks whose tags do not match these values',
      source: 'ansible-playbook',
    },

    // Host limiting
    {
      flag: '-l, --limit <subset>',
      description: 'further limit selected hosts to an additional pattern',
      source: 'ansible-playbook',
    },

    // Execution modes
    {
      flag: '-C, --check',
      description: "don't make any changes; instead, try to predict some changes",
      source: 'ansible-playbook',
    },
    {
      flag: '-D, --diff',
      description: 'when changing files, show the differences',
      source: 'ansible-playbook',
    },
    {
      flag: '--step',
      description: 'one-step-at-a-time: confirm each task before running',
      source: 'ansible-playbook',
    },

    // Verbose output
    {
      flag: '-v, --verbose',
      description: 'verbose mode (-vvv for more, -vvvv to enable connection debugging)',
      source: 'ansible-playbook',
    },

    // Variables
    {
      flag: '-e, --extra-vars <vars>',
      description: 'set additional variables as key=value or YAML/JSON, or @filename',
      source: 'ansible-playbook',
    },

    // Privilege escalation
    {
      flag: '--ask-become-pass',
      description: 'ask for privilege escalation password',
      source: 'ansible-playbook',
    },
    {
      flag: '--become-user <user>',
      description: 'run operations as this user (default=root)',
      source: 'ansible-playbook',
    },

    // Vault-related
    {
      flag: '--vault-password-file <file>',
      description: 'vault password file',
      source: 'ansible-playbook',
    },
    { flag: '--ask-vault-pass', description: 'ask for vault password', source: 'ansible-playbook' },

    // Task control
    {
      flag: '--start-at-task <task>',
      description: 'start the playbook at the task matching this name',
      source: 'ansible-playbook',
    },
    {
      flag: '--list-tasks',
      description: 'list all tasks that would be executed',
      source: 'ansible-playbook',
    },
    { flag: '--list-tags', description: 'list all available tags', source: 'ansible-playbook' },

    // Connection-related
    {
      flag: '--timeout <timeout>',
      description: 'override the connection timeout in seconds',
      source: 'ansible-playbook',
    },
    {
      flag: '--connection <connection>',
      description: 'connection type to use',
      source: 'ansible-playbook',
    },
    {
      flag: '--ssh-common-args <args>',
      description: 'specify common arguments to pass to sftp/scp/ssh',
      source: 'ansible-playbook',
    },
  ];
}

/**
 * Dynamically add Ansible parameters to Commander command
 * @param command Commander command instance
 * @param params Array of parameter definitions
 * @param excludeConflicting Whether to exclude options that might conflict with existing options
 */
export function addAnsibleParamsToCommand(
  command: Command,
  params: AnsibleParam[],
  excludeConflicting = false
): void {
  // List of conflicting options that are already defined in the main program
  const conflictingOptions = [
    '-h, --help', // Built-in Commander option
  ];

  params.forEach(param => {
    try {
      // Skip conflicting options if requested
      if (excludeConflicting && conflictingOptions.includes(param.flag)) {
        return;
      }

      // Add [ansible] prefix to make it clear these are ansible options
      const descriptionWithPrefix = `[ansible] ${param.description}`;
      command.option(param.flag, descriptionWithPrefix);
    } catch (error) {
      console.warn(`Failed to add option ${param.flag}:`, error);
    }
  });
}

/**
 * Extract Ansible parameters from Commander options
 * @param options Commander parsed options object
 * @param params Known Ansible parameter definitions
 * @returns Array of Ansible arguments
 */
export function extractAnsibleArgsFromOptions(options: any, params: AnsibleParam[]): string[] {
  const ansibleArgs: string[] = [];

  params.forEach(param => {
    // Parse parameter name (remove prefix and type information)
    const flagMatch = param.flag.match(/--([a-z-]+)/);
    if (!flagMatch) return;

    const flagName = flagMatch[1]; // e.g., "skip-tags", "become-user"
    // Convert to camelCase: "skip-tags" -> "skipTags", "become-user" -> "becomeUser"
    const camelCaseOptionName = flagName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

    const value = options[camelCaseOptionName];
    if (value !== undefined) {
      const longFlag = `--${flagName}`;

      if (typeof value === 'boolean' && value) {
        // Boolean option
        ansibleArgs.push(longFlag);
      } else if (typeof value === 'string') {
        // String option
        ansibleArgs.push(longFlag, value);
      }
    }
  });

  return ansibleArgs;
}
