/**
 * Ansible utility functions
 */

/**
 * CLI tool specific options that should not be passed to Ansible
 */
export const CLI_SPECIFIC_OPTIONS = [
  // Connection options
  'server',
  's',
  'host',
  'h',
  'user',
  'u',
  'password',
  'p',
  'key',
  'k',
  'last',
  'l',
  'reuse',
  // Aship host options
  'hosts',
  // Mode options
  'interactive',
  'non-interactive',
  'mode',
  // Variable collection options
  'group',
  'no-group',
  'skip-vars',
  'no-skip-vars',
  'S',
  'yes',
  'y',
  // Configuration options
  'config',
  'c',
  // Other CLI tool specific options
  'verbose',
  'v',
  // Debug and output options
  'debug',
  'quiet',
  'q',
  // JSON output options
  'json',
  // Filter options
  'filter-tag',
  // Minimal output
  'minimal',
];

/**
 * Common Ansible parameters that are always safe to pass
 */
const SAFE_ANSIBLE_PARAMS = new Set([
  // Core options
  '--help',
  '-h',
  '--version',
  '--verbose',
  '-v',
  '-vv',
  '-vvv',
  '-vvvv',
  '--check',
  '-C',
  '--diff',
  '-D',
  '--dry-run',

  // Inventory and targeting
  '--inventory',
  '-i',
  '--limit',
  '-l',
  '--list-hosts',
  '--list-tasks',
  '--list-tags',

  // Variables and configuration
  '--extra-vars',
  '-e',
  '--tags',
  '-t',
  '--skip-tags',
  '--start-at-task',

  // Connection options
  '--connection',
  '-c',
  '--timeout',
  '-T',
  '--user',
  '-u',
  '--become',
  '-b',
  '--become-method',
  '--become-user',
  '--ask-become-pass',
  '-K',
  '--private-key',
  '--ssh-common-args',
  '--ssh-extra-args',
  '--scp-extra-args',
  '--sftp-extra-args',

  // Output and logging
  '--one-line',
  '-o',
  '--tree',
  '--flush-cache',
  '--force-handlers',
  '--step',
  '--syntax-check',
]);

/**
 * Validate Ansible arguments against known supported parameters
 * @param args Array of arguments to validate
 * @param knownParams Array of known Ansible parameters (optional)
 * @returns Object with valid args and warnings for invalid ones
 */
export function validateAnsibleArgs(
  args: string[],
  knownParams: string[] = []
): {
  validArgs: string[];
  warnings: string[];
} {
  const validArgs: string[] = [];
  const warnings: string[] = [];

  // Combine safe params with known params
  const allKnownParams = new Set([...SAFE_ANSIBLE_PARAMS, ...knownParams]);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip non-option arguments (values for options)
    if (!arg.startsWith('-')) {
      validArgs.push(arg);
      continue;
    }

    // Check if it's a known safe parameter
    if (allKnownParams.has(arg)) {
      validArgs.push(arg);

      // If this option expects a value, include the next argument
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        validArgs.push(args[++i]);
      }
    } else {
      // For unknown parameters, issue a warning but still pass them through
      // This allows for forward compatibility with newer Ansible versions
      warnings.push(`Unknown Ansible parameter: ${arg} (passing through)`);
      validArgs.push(arg);

      // Conservatively assume it might need a value
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        validArgs.push(args[++i]);
      }
    }
  }

  return { validArgs, warnings };
}

/**
 * Filter out aship-specific arguments that should not be passed to Ansible
 * @param args Array of arguments to filter
 * @returns Filtered arguments safe for Ansible
 */
export function filterAshipSpecificArgs(args: string[]): string[] {
  const filteredArgs: string[] = [];
  const cliOptionsSet = new Set(CLI_SPECIFIC_OPTIONS);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip non-option arguments
    if (!arg.startsWith('-')) {
      filteredArgs.push(arg);
      continue;
    }

    // Extract option name without dashes
    const optionName = arg.replace(/^-+/, '');

    // Skip aship-specific options
    if (cliOptionsSet.has(optionName)) {
      // Skip the option and its value if it has one
      if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
        i++; // Skip the value
      }
      continue;
    }

    // Keep the argument
    filteredArgs.push(arg);

    // If this option has a value, keep it too
    if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
      filteredArgs.push(args[++i]);
    }
  }

  return filteredArgs;
}

/**
 * Extract Ansible options from command line arguments
 * @param args Command line arguments
 * @returns Ansible options array
 */
export function extractAnsibleOptions(args: string[]): string[] {
  const ansibleOptions: string[] = [];
  const cliOptions = new Set(CLI_SPECIFIC_OPTIONS);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip the command name and subcommand
    if (i === 0 || (i === 1 && !arg.startsWith('-'))) {
      continue;
    }

    // Skip playbook path
    if (!arg.startsWith('-') && i > 0 && args[i - 1] === 'playbook') {
      continue;
    }

    // Check if it's an option
    if (arg.startsWith('-')) {
      // Extract option name without dashes
      const option = arg.replace(/^-+/, '');

      // If it's not a CLI tool option, add it to Ansible options
      if (cliOptions.has(option)) {
        // Skip CLI tool option value
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          i++;
        }
      } else {
        ansibleOptions.push(arg);

        // If the option has a value, add it too
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          ansibleOptions.push(args[++i]);
        }
      }
    }
  }

  return ansibleOptions;
}
