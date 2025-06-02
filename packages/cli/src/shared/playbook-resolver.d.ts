/**
 * Playbook input resolver for unified run command
 */
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
export declare class PlaybookNotFoundError extends Error {
  constructor(input: string, config: ProjectConfig);
}
/**
 * Check if input looks like a file path
 * @param input User input string
 * @returns True if input appears to be a file path
 */
export declare function isFilePath(input: string): boolean;
/**
 * Parse and resolve playbook input
 * @param input User input (playbook name or file path)
 * @param config Project configuration
 * @returns Resolved playbook input information
 */
export declare function parsePlaybookInput(input: string, config: ProjectConfig): PlaybookInput;
/**
 * Auto-select playbook when no input provided
 * @param config Project configuration
 * @returns Auto-selected playbook name or undefined
 */
export declare function autoSelectPlaybook(config: ProjectConfig): string | undefined;
//# sourceMappingURL=playbook-resolver.d.ts.map
