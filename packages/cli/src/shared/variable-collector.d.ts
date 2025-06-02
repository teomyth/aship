/**
 * Variable collector for CLI commands
 *
 * This module provides shared functionality for collecting and managing variables
 * from aship.yml configuration files.
 */
import type { ProjectConfig, VariableDefinition } from '@aship/core';
/**
 * Parse extra variables from command line
 * @param extraVarsStr Extra variables string (format: key1=value1,key2=value2)
 * @returns Parsed extra variables
 */
export declare function parseExtraVars(extraVarsStr?: string): Record<string, any>;
/**
 * Configure variables from config definition
 * @param config Project configuration
 * @param existingVars Existing variable values
 * @returns Configured variables
 */
export declare function collectVariablesFromConfig(
  config: ProjectConfig,
  existingVars?: Record<string, any>
): Promise<Record<string, any>>;
/**
 * Configure variables from variable definitions (for testing and direct use)
 * @param vars Variable definitions
 * @param existingVars Existing variable values
 * @returns Configured variables
 */
export declare function collectVariablesFromDefinitions(
  vars: Record<string, VariableDefinition>,
  existingVars?: Record<string, any>
): Promise<Record<string, any>>;
//# sourceMappingURL=variable-collector.d.ts.map
