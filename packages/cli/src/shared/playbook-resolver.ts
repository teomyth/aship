/**
 * Playbook input resolver for unified run command
 */

import * as path from 'node:path';
import type { ProjectConfig } from '@aship/core';

/**
 * Playbook input type and resolution result
 */
export interface PlaybookInput {
  /**
   * Input type: config name or file path
   */
  type: 'config' | 'file';

  /**
   * Original input value
   */
  value: string;

  /**
   * Resolved playbook file path
   */
  resolvedPath: string;
}

/**
 * Custom error for playbook not found scenarios
 */
export class PlaybookNotFoundError extends Error {
  constructor(input: string, config: ProjectConfig) {
    const available = Object.keys(config.playbooks || {});

    let message = `Playbook '${input}' not found.`;

    if (available.length > 0) {
      message += '\n\nAvailable playbooks in aship.yml:';
      available.forEach(name => {
        message += `\n  - ${name} (${config.playbooks?.[name]})`;
      });
    } else {
      message += '\n\nNo playbooks defined in aship.yml.';
    }

    message += '\n\nOr specify a file path:';
    message += '\n  aship run path/to/playbook.yml';

    super(message);
    this.name = 'PlaybookNotFoundError';
  }
}

/**
 * Check if input looks like a file path
 * @param input User input string
 * @returns True if input appears to be a file path
 */
export function isFilePath(input: string): boolean {
  // 1. Contains path separators
  if (input.includes('/') || input.includes('\\')) {
    return true;
  }

  // 2. Ends with .yml or .yaml extension
  if (input.endsWith('.yml') || input.endsWith('.yaml')) {
    return true;
  }

  // 3. Is an absolute path
  if (path.isAbsolute(input)) {
    return true;
  }

  return false;
}

/**
 * Parse and resolve playbook input
 * @param input User input (playbook name or file path)
 * @param config Project configuration
 * @returns Resolved playbook input information
 */
export function parsePlaybookInput(input: string, config: ProjectConfig): PlaybookInput {
  // 1. Check if input looks like a file path
  if (isFilePath(input)) {
    return {
      type: 'file',
      value: input,
      resolvedPath: path.resolve(input),
    };
  }

  // 2. Check if input matches a playbook name in config
  if (config.playbooks?.[input]) {
    return {
      type: 'config',
      value: input,
      resolvedPath: path.resolve(config.playbooks[input]),
    };
  }

  // 3. Input not found - throw helpful error
  throw new PlaybookNotFoundError(input, config);
}

/**
 * Auto-select playbook when no input provided
 * @param config Project configuration
 * @returns Auto-selected playbook name or undefined
 */
export function autoSelectPlaybook(config: ProjectConfig): string | undefined {
  const playbooks = config.playbooks || {};
  const playbookNames = Object.keys(playbooks);

  // If only one playbook is defined, auto-select it
  if (playbookNames.length === 1) {
    return playbookNames[0];
  }

  // Multiple or no playbooks - let caller handle
  return undefined;
}
