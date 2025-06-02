/**
 * Variable collector for CLI commands
 *
 * This module provides shared functionality for collecting and managing variables
 * from aship.yml configuration files.
 */

import { type ProjectConfig, type VariableDefinition, logger } from '@aship/core';
import chalk from 'chalk';
import inquirer from 'inquirer';

/**
 * Parse extra variables from command line
 * @param extraVarsStr Extra variables string (format: key1=value1,key2=value2)
 * @returns Parsed extra variables
 */
export function parseExtraVars(extraVarsStr?: string): Record<string, any> {
  if (!extraVarsStr) {
    return {};
  }

  const extraVars: Record<string, any> = {};
  const pairs = extraVarsStr.split(',');

  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      // Try to parse as JSON if possible
      try {
        extraVars[key.trim()] = JSON.parse(value.trim());
      } catch (_e) {
        // If not valid JSON, use as string
        extraVars[key.trim()] = value.trim();
      }
    }
  }

  return extraVars;
}

/**
 * Configure variables from config definition
 * @param config Project configuration
 * @param existingVars Existing variable values
 * @returns Configured variables
 */
export async function collectVariablesFromConfig(
  config: ProjectConfig,
  existingVars: Record<string, any> = {}
): Promise<Record<string, any>> {
  const vars = config.vars || {};
  return collectVariablesFromDefinitions(vars, existingVars);
}

/**
 * Configure variables from variable definitions (for testing and direct use)
 * @param vars Variable definitions
 * @param existingVars Existing variable values
 * @returns Configured variables
 */
export async function collectVariablesFromDefinitions(
  vars: Record<string, VariableDefinition>,
  existingVars: Record<string, any> = {}
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  const varEntries = Object.entries(vars);
  const totalCount = varEntries.length;

  // If no variables to configure, return empty object
  if (totalCount === 0) {
    return result;
  }

  logger.subsection('Variable Configuration');
  logger.info('Please provide values for the following variables:');

  // Configure variables one by one with progress
  for (let index = 0; index < varEntries.length; index++) {
    const [name, varDef] = varEntries[index];
    const currentPosition = index + 1;
    // Type assertion for varDef
    const typedVarDef = varDef as VariableDefinition;

    // Use existing value if available, otherwise use default
    // For password type, don't use existing values as default
    const defaultValue =
      typedVarDef.type === 'password'
        ? typedVarDef.default
        : existingVars[name] !== undefined
          ? existingVars[name]
          : typedVarDef.default;

    // Display multi-line description with left border
    if (typedVarDef.description?.includes('\n')) {
      console.log(''); // Add spacing before the description

      // Variable name header
      console.log(`  ${chalk.cyan.bold(name)}:`);

      // Description content with left border
      const lines = typedVarDef.description.split('\n');
      lines.forEach((line: string, index: number) => {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          if (index === 0) {
            // Main description
            console.log(`  │ ${chalk.gray(trimmedLine)}`);
          } else if (trimmedLine.startsWith('•')) {
            // Format options
            console.log(`  │ ${chalk.dim(trimmedLine)}`);
          } else {
            // Other content
            console.log(`  │ ${chalk.gray(trimmedLine)}`);
          }
        } else if (index > 0 && index < lines.length - 1) {
          // Empty line in the middle
          console.log('  │');
        }
      });

      console.log(''); // Add spacing after the description
    }

    // Create progress prefix
    const progressPrefix = `[${currentPosition}/${totalCount}]`;

    // Create a simple, clean prompt message
    const message = createPromptMessage(name, typedVarDef, existingVars[name], progressPrefix);

    const promptConfig: any = {
      type: getInputType(typedVarDef.type),
      name: 'value',
      message,
      validate: (input: any) => validateInput(input, typedVarDef),
    };

    // Only set default value for non-password types
    if (typedVarDef.type !== 'password') {
      promptConfig.default = formatValueForInput(defaultValue, typedVarDef.type);
    }

    // Add mask for password type
    if (typedVarDef.type === 'password') {
      promptConfig.mask = '*';
    }

    // Add choices for choice and multiselect types
    if (
      (typedVarDef.type === 'choice' || typedVarDef.type === 'multiselect') &&
      typedVarDef.choices
    ) {
      promptConfig.choices = typedVarDef.choices;
    }

    const response = await inquirer.prompt(promptConfig);

    result[name] = convertValue(response.value, typedVarDef.type);
  }

  return result;
}

/**
 * Create a clean prompt message for variable input
 * @param name Variable name
 * @param varDef Variable definition
 * @param existingValue Existing value if any
 * @param progressPrefix Progress prefix like [1/5]
 * @returns Formatted prompt message
 */
function createPromptMessage(
  name: string,
  varDef: any,
  existingValue: any,
  progressPrefix?: string
): string {
  const prefix = progressPrefix ? `${progressPrefix} ` : '';

  // For multi-line descriptions, use a simple prompt since description is shown separately
  if (varDef.description?.includes('\n')) {
    // Don't show previous value for password type
    if (existingValue !== undefined && varDef.type !== 'password') {
      return chalk.yellow(
        `${prefix}Enter ${name} ${chalk.dim(`(current: ${formatValueForDisplay(existingValue)})`)}`
      );
    }
    return chalk.yellow(`${prefix}Enter ${name}`);
  }

  // For single-line descriptions, include them in the prompt with enhanced color
  const description = varDef.description || name;
  // Don't show previous value for password type
  if (existingValue !== undefined && varDef.type !== 'password') {
    return chalk.yellow(
      `${prefix}${description} ${chalk.dim(`(current: ${formatValueForDisplay(existingValue)})`)}`
    );
  }
  return chalk.yellow(`${prefix}${description}:`);
}

/**
 * Get inquirer input type based on variable type
 * @param type Variable type
 * @returns Inquirer input type
 */
function getInputType(type: string): 'input' | 'confirm' | 'password' | 'list' | 'checkbox' {
  switch (type) {
    case 'bool':
      return 'confirm';
    case 'password':
      return 'password';
    case 'choice':
      return 'list';
    case 'multiselect':
      return 'checkbox';
    default:
      return 'input';
  }
}

/**
 * Validate input based on variable definition
 * @param input Input value
 * @param varDef Variable definition
 * @returns Validation result
 */
function validateInput(input: any, varDef: any): boolean | string {
  if (varDef.required && (input === undefined || input === null || input === '')) {
    return 'This field is required';
  }

  if (varDef.type === 'int' && input !== '' && input !== undefined) {
    const num = Number(input);
    if (Number.isNaN(num) || !Number.isInteger(num)) {
      return 'Please enter a valid integer';
    }

    // Check min/max constraints
    if (varDef.min !== undefined && num < varDef.min) {
      return `Value must be at least ${varDef.min}`;
    }
    if (varDef.max !== undefined && num > varDef.max) {
      return `Value must be at most ${varDef.max}`;
    }
  }

  if (varDef.type === 'choice' && input !== '' && input !== undefined) {
    if (!varDef.choices || !varDef.choices.includes(input)) {
      return `Value must be one of: ${varDef.choices?.join(', ') || 'no choices available'}`;
    }
  }

  if (varDef.type === 'multiselect' && input !== '' && input !== undefined) {
    if (!Array.isArray(input)) {
      return 'Multiselect value must be an array';
    }
    if (!varDef.choices) {
      return 'No choices available for multiselect variable';
    }

    // Extract values from input - handle both string arrays and object arrays
    const inputValues = input.map(item => {
      if (typeof item === 'string') {
        return item;
      }
      if (typeof item === 'object' && item !== null && 'value' in item) {
        return item.value;
      }
      return String(item);
    });

    const invalidChoices = inputValues.filter(choice => !varDef.choices?.includes(choice));
    if (invalidChoices.length > 0) {
      return `Invalid choices: ${invalidChoices.join(', ')}. Must be one of: ${varDef.choices.join(', ')}`;
    }
  }

  if (varDef.type === 'string' && varDef.pattern && input !== '' && input !== undefined) {
    const regex = new RegExp(varDef.pattern);
    if (!regex.test(input)) {
      return `Value does not match required pattern: ${varDef.pattern}`;
    }
  }

  return true;
}

/**
 * Format value for display in prompts
 * @param value Value to format
 * @returns Formatted string for display
 */
function formatValueForDisplay(value: any): string {
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (typeof value === 'object' && value !== null) {
    return JSON.stringify(value);
  }
  return JSON.stringify(value);
}

/**
 * Format value for input field default
 * @param value Value to format
 * @param type Variable type
 * @returns Formatted value for input
 */
function formatValueForInput(value: any, type: string): any {
  switch (type) {
    case 'list':
      return Array.isArray(value) ? value.join(',') : value;
    case 'multiselect':
      return Array.isArray(value) ? value : [];
    case 'bool':
      return Boolean(value);
    default:
      return value;
  }
}

/**
 * Convert input value to appropriate type
 * @param value Input value
 * @param type Variable type
 * @returns Converted value
 */
function convertValue(value: any, type: string): any {
  switch (type) {
    case 'int':
      return Number(value);
    case 'bool':
      return Boolean(value);
    case 'list':
      if (typeof value === 'string') {
        return value
          .split(',')
          .map(item => item.trim())
          .filter(item => item.length > 0);
      }
      return Array.isArray(value) ? value : [value];
    case 'multiselect':
      // inquirer checkbox returns an array, extract values if they are objects
      if (Array.isArray(value)) {
        return value.map(item => {
          if (typeof item === 'string') {
            return item;
          }
          if (typeof item === 'object' && item !== null && 'value' in item) {
            return item.value;
          }
          return String(item);
        });
      }
      return [];
    default:
      return String(value);
  }
}
