import * as fs from 'node:fs';
import { DirectoryManager } from '../config/directory-manager.js';
import { executeCommand } from '../utils/process.js';

// Import chalk for colorized output
let chalk: any = {
  bold: (str: string) => str,
  blue: (str: string) => str,
  cyan: (str: string) => str,
  yellow: (str: string) => str,
  green: (str: string) => str,
  gray: (str: string) => str,
};

// Initialize chalk asynchronously
(async () => {
  try {
    const chalkModule = await import('chalk');
    chalk = chalkModule.default;
  } catch (_error) {
    // Keep the mock implementation
  }
})();

// Use DirectoryManager to manage all paths
const directoryManager = new DirectoryManager();

/**
 * Interface for Ansible parameter
 */
export interface AnsibleParameter {
  shortFlag?: string;
  longFlag: string;
  valueType?: string | null;
  description: string;
  conflictsWith?: string | null;
}

/**
 * Check if Ansible version has changed and update parameters if needed
 */
export async function checkAndUpdateAnsibleParameters(): Promise<void> {
  try {
    // Get Ansible version
    const versionResult = await executeCommand('ansible --version');
    const versionMatch = versionResult.stdout.match(/ansible \[core (\d+\.\d+\.\d+)\]/);
    const currentVersion = versionMatch ? versionMatch[1] : 'unknown';

    const configFilePath = directoryManager.ansibleConfigFile;

    // Initialize directory structure, ensure necessary directories exist
    await directoryManager.initialize();

    // Check if parameters need to be updated
    let needsUpdate = true;
    try {
      if (await directoryManager.fileExists(configFilePath)) {
        const configData = JSON.parse(await fs.promises.readFile(configFilePath, 'utf8'));
        if (configData.version === currentVersion) {
          needsUpdate = false;
        }
      }
    } catch (error) {
      console.error('Error reading ansible config file:', error);
    }

    // If updates are needed, regenerate parameter file
    if (needsUpdate) {
      await generateAnsibleParametersFile(configFilePath, currentVersion);
    }
  } catch (error) {
    console.error('Error checking Ansible parameters:', error);
  }
}

/**
 * Generate Ansible parameters file by parsing ansible-playbook --help
 */
async function generateAnsibleParametersFile(filePath: string, version: string): Promise<void> {
  try {
    // Run ansible-playbook --help
    const helpResult = await executeCommand('ansible-playbook --help');

    // Parse parameters
    const parameters = parseAnsibleHelp(helpResult.stdout);

    // Check for conflicts with CLI tool parameters
    const cliParams = getCliParameters();
    for (const param of parameters) {
      for (const cliParam of cliParams) {
        if (
          (param.shortFlag && param.shortFlag === cliParam.shortFlag) ||
          (param.longFlag && param.longFlag === cliParam.longFlag)
        ) {
          param.conflictsWith = `cli-tool-${cliParam.longFlag.replace('--', '')}`;
        }
      }
    }

    // Create parameters data
    const paramsData = {
      version,
      lastUpdated: new Date().toISOString(),
      parameters,
    };

    // Write to file
    await fs.promises.writeFile(filePath, JSON.stringify(paramsData, null, 2));
  } catch (error) {
    console.error('Error generating Ansible parameters file:', error);
  }
}

/**
 * Parse ansible-playbook --help output to extract parameters
 */
function parseAnsibleHelp(helpText: string): AnsibleParameter[] {
  const parameters: AnsibleParameter[] = [];
  const lines = helpText.split('\n');

  // Find the options section
  let inOptionsSection = false;

  for (const line of lines) {
    // Check if we're in the options section
    if (line.trim() === 'options:') {
      inOptionsSection = true;
      continue;
    }

    // Skip if not in options section and not a parameter line
    if (!inOptionsSection && !line.trim().startsWith('-')) continue;

    // Parse option line
    // Match patterns like:
    // -h, --help            show this help message and exit
    // --version             show program's version number, config file location...
    // -v, --verbose         Causes Ansible to print more debug messages...
    // -i INVENTORY, --inventory INVENTORY, --inventory-file INVENTORY

    // Try to match lines with both short and long flags
    // Pattern: -t, --tags TAGS       description
    let match = line.match(/^\s+(-[a-zA-Z]),\s+(--[\w-]+)(?:\s+([A-Z_]+))?(?:,.*?)?\s+(.+)$/);

    // If that doesn't match, try to match lines with only long flags
    // Pattern: --tags TAGS       description
    if (!match) {
      match = line.match(/^\s+(--[\w-]+)(?:\s+([A-Z_]+))?(?:,.*?)?\s+(.+)$/);
      if (match) {
        parameters.push({
          longFlag: match[1],
          description: match[3] ? match[3].trim() : match[2].trim(),
          valueType: match[2] || null,
          conflictsWith: null,
        });
      }
      continue;
    }

    if (match) {
      parameters.push({
        shortFlag: match[1],
        longFlag: match[2],
        description: match[4].trim(),
        valueType: match[3] || null,
        conflictsWith: null,
      });
    }
  }

  // Add some common parameters manually if they weren't detected
  const commonParams = [
    {
      shortFlag: '-i',
      longFlag: '--inventory',
      valueType: 'INVENTORY',
      description: 'specify inventory host path or comma separated host list',
    },
    {
      shortFlag: '-v',
      longFlag: '--verbose',
      valueType: null,
      description: 'verbose mode (-vvv for more, -vvvv to enable connection debugging)',
    },
    {
      shortFlag: '-e',
      longFlag: '--extra-vars',
      valueType: 'VARS',
      description: 'set additional variables as key=value or YAML/JSON',
    },
    {
      shortFlag: '-t',
      longFlag: '--tags',
      valueType: 'TAGS',
      description: 'only run plays and tasks tagged with these values',
    },
    {
      shortFlag: '-l',
      longFlag: '--limit',
      valueType: 'SUBSET',
      description: 'further limit selected hosts to an additional pattern',
    },
    {
      shortFlag: '-C',
      longFlag: '--check',
      valueType: null,
      description:
        "don't make any changes; instead, try to predict some of the changes that may occur",
    },
    {
      shortFlag: '-D',
      longFlag: '--diff',
      valueType: null,
      description: 'when changing (small) files and templates, show the differences in those files',
    },
    {
      longFlag: '--skip-tags',
      valueType: 'SKIP_TAGS',
      description: 'only run plays and tasks whose tags do not match these values',
    },
  ];

  // Add common parameters, replacing any existing ones with the same flag
  for (const param of commonParams) {
    const existingIndex = parameters.findIndex(p => p.longFlag === param.longFlag);
    if (existingIndex >= 0) {
      // Replace existing parameter with the manually defined one
      parameters[existingIndex] = param;
    } else {
      // Add new parameter
      parameters.push(param);
    }
  }

  return parameters;
}

/**
 * Get CLI tool parameters for conflict checking
 */
function getCliParameters(): AnsibleParameter[] {
  // These are the parameters that the CLI tool uses that might conflict with ansible-playbook
  return [
    {
      shortFlag: '-s',
      longFlag: '--server',
      valueType: 'servers',
      description: 'Target server(s) to run the playbook on',
    },
    { shortFlag: '-v', longFlag: '--verbose', valueType: null, description: 'Show verbose output' },
    {
      shortFlag: '-e',
      longFlag: '--extra-vars',
      valueType: 'key=value',
      description: 'Extra variables',
    },
    { longFlag: '--non-interactive', valueType: null, description: 'Run in non-interactive mode' },
    { longFlag: '--mode', valueType: 'mode', description: 'Interaction mode' },
    {
      longFlag: '--no-group',
      valueType: null,
      description: 'Do not group variables by their group property',
    },
  ];
}

/**
 * Process command line arguments to separate CLI tool and Ansible arguments
 */
export function processCommandLineArgs(args: string[]): {
  cliArgs: string[];
  ansibleArgs: string[];
} {
  const _paramsPath = directoryManager.ansibleParamsFile;

  const cliArgs: string[] = [];
  const ansibleArgs: string[] = [];

  // Load known Ansible parameters
  let ansibleParams: AnsibleParameter[] = [];
  const ansibleConfigPath = directoryManager.ansibleConfigFile;
  if (fs.existsSync(ansibleConfigPath)) {
    try {
      const configData = JSON.parse(fs.readFileSync(ansibleConfigPath, 'utf8'));
      ansibleParams = configData.parameters || [];
    } catch (error) {
      console.error('Error reading ansible config file:', error);
    }
  }

  // Create parameter lookup maps
  const ansibleFlagsMap = new Map<string, AnsibleParameter>();
  for (const param of ansibleParams) {
    if (param.shortFlag) ansibleFlagsMap.set(param.shortFlag, param);
    if (param.longFlag) ansibleFlagsMap.set(param.longFlag, param);
  }

  const cliFlagsMap = new Map<string, AnsibleParameter>();
  for (const param of getCliParameters()) {
    if (param.shortFlag) cliFlagsMap.set(param.shortFlag, param);
    if (param.longFlag) cliFlagsMap.set(param.longFlag, param);
  }

  // Process each argument
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Check if it's a CLI tool parameter
    if (cliFlagsMap.has(arg)) {
      cliArgs.push(arg);
      // If parameter needs a value, add it
      const param = cliFlagsMap.get(arg);
      if (param?.valueType && i + 1 < args.length && !args[i + 1].startsWith('-')) {
        cliArgs.push(args[++i]);
      }
    }
    // Check if it's an Ansible parameter
    else if (ansibleFlagsMap.has(arg)) {
      const param = ansibleFlagsMap.get(arg);
      // If parameter conflicts with CLI tool, use CLI tool's handling
      if (param?.conflictsWith) {
        cliArgs.push(arg);
        if (param.valueType && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          cliArgs.push(args[++i]);
        }
      } else {
        // Otherwise pass to Ansible
        ansibleArgs.push(arg);
        if (param?.valueType && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          ansibleArgs.push(args[++i]);
        }
      }
    }
    // Unknown parameter or playbook path
    else {
      // If it starts with a dash, assume it's an unknown Ansible parameter
      if (arg.startsWith('-')) {
        ansibleArgs.push(arg);
        // Conservatively assume it might need a value
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          ansibleArgs.push(args[++i]);
        }
      } else {
        // Otherwise it's probably a playbook path or other positional argument
        cliArgs.push(arg);
      }
    }
  }

  return { cliArgs, ansibleArgs };
}

/**
 * Generate help text including Ansible parameters
 */
export function generateAnsibleHelpText(): string {
  const ansibleConfigPath = directoryManager.ansibleConfigFile;

  // We're using the global chalk variable defined at the top of the file

  let help = '';

  // Read Ansible version
  let ansibleVersion = 'unknown';
  try {
    if (fs.existsSync(ansibleConfigPath)) {
      const ansibleConfig = JSON.parse(fs.readFileSync(ansibleConfigPath, 'utf8'));
      ansibleVersion = ansibleConfig.version;
    }
  } catch (error) {
    console.error('Error reading ansible config file:', error);
  }

  // Read Ansible parameters
  if (fs.existsSync(ansibleConfigPath)) {
    try {
      const configData = JSON.parse(fs.readFileSync(ansibleConfigPath, 'utf8'));

      help += `\n${chalk.bold('Options inherited from ansible-playbook:')}\n`;

      // Find the maximum length of flag text for alignment
      let maxFlagLength = 0;
      const visibleParams = configData.parameters.filter((p: AnsibleParameter) => !p.conflictsWith);

      for (const param of visibleParams) {
        const flagText = param.shortFlag ? `${param.shortFlag}, ${param.longFlag}` : param.longFlag;
        const valueText = param.valueType ? ` <${param.valueType}>` : '';
        const totalLength = (flagText + valueText).length;
        maxFlagLength = Math.max(maxFlagLength, totalLength);
      }

      // Add some padding
      maxFlagLength += 2;

      // Display parameters with aligned descriptions
      for (const param of visibleParams) {
        const flagText = param.shortFlag ? `${param.shortFlag}, ${param.longFlag}` : param.longFlag;
        const valueText = param.valueType ? ` <${param.valueType}>` : '';

        // Add the parameter to the help text
        help += `  ${chalk.blue(flagText)}${chalk.cyan(valueText)}${' '.repeat(maxFlagLength - (flagText + valueText).length)}${param.description}\n`;
      }

      help += `\nAnsible version: ${chalk.yellow(ansibleVersion)}\n`;
      help += `${chalk.cyan('All non-conflicting ansible-playbook options are passed through to ansible-playbook.')}\n`;
    } catch {
      // Silently handle error - this is not critical for help display
    }
  }

  return help;
}
