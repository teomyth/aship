import {
  AnsibleExecutor,
  DirectoryManager,
  type FileTypeConfig,
  HostManager,
  InventoryGenerator,
  LogLevel,
  PlaybookRunner,
  type ProjectConfig,
  checkAndUpdateAnsibleParameters,
  extractAnsibleOptions,
  logger,
  resolveFilePath,
} from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../utils/oclif-formatter.js';

// Import shared utilities
import {
  PlaybookNotFoundError,
  autoSelectPlaybook,
  parsePlaybookInput,
} from '../shared/playbook-resolver.js';
import {
  determineConnectionMode,
  loadConfiguration,
  resolveTargetServers,
} from '../shared/server-connection-manager.js';
import { collectTagsFromConfig, shouldCollectTags } from '../shared/tags-collector.js';
import { collectVariablesFromConfig, parseExtraVars } from '../shared/variable-collector.js';
import {
  extractAnsibleArgsFromOptions,
  loadCommonAnsibleParams,
} from '../utils/ansible-params-loader.js';

// Force enable colors for chalk
chalk.level = 3;
process.env.FORCE_COLOR = '1';

/**
 * Playbook file type configuration (fallback for old format)
 */
const PLAYBOOK_FILE_CONFIG: FileTypeConfig = {
  extensions: ['.yml', '.yaml'],
  defaultFileName: 'playbook',
  defaultDirName: 'playbooks',
  description: 'Playbook',
};

export default class Run extends Command {
  static override args = {
    playbook: Args.string({
      description: 'Playbook name from aship.yml or file path',
      required: false,
    }),
  };

  static override description = 'Run a playbook by name or file path';

  static override examples = [
    '<%= config.bin %> <%= command.id %> setup',
    '<%= config.bin %> <%= command.id %> site.yml',
    '<%= config.bin %> <%= command.id %> setup -S',
    '<%= config.bin %> <%= command.id %> setup -y',
    '<%= config.bin %> <%= command.id %> deploy -e "env=prod,port=8080"',
    '<%= config.bin %> <%= command.id %> setup --tags common --check',
    '<%= config.bin %> <%= command.id %> deploy -H web-prod-1,db-server',
    '<%= config.bin %> <%= command.id %> deploy -i custom.yml',
    '<%= config.bin %> <%= command.id %> deploy -H web-prod-1 -i base.yml',
  ];

  static override flags = {
    // Connection options
    server: Flags.string({
      char: 's',
      description: 'Target server(s) to run on (comma-separated)',
      multiple: false,
    }),
    host: Flags.string({
      char: 'h',
      description: 'Directly specify a host to connect to',
    }),
    user: Flags.string({
      char: 'u',
      description: 'Username for connection',
    }),
    password: Flags.string({
      char: 'p',
      description: 'Password for connection',
    }),
    key: Flags.string({
      char: 'k',
      description: 'SSH key for connection',
    }),
    reuse: Flags.boolean({
      description: 'Reuse previous connection information without prompting',
      default: false,
    }),

    // Aship host options
    hosts: Flags.string({
      char: 'H',
      description: 'Use aship hosts (comma-separated host names)',
    }),
    inventory: Flags.string({
      char: 'i',
      description: 'Use specific inventory file',
    }),
    'inventory-mode': Flags.string({
      char: 'm',
      description: 'How to handle mixed inventory (replace|inject|merge)',
      default: 'inject',
      options: ['replace', 'inject', 'merge'],
    }),
    'dry-run': Flags.boolean({
      description: 'Show the command that would be executed without running it',
      default: false,
    }),
    'show-full-command': Flags.boolean({
      description: 'Show full command with real paths instead of placeholders',
      default: false,
    }),
    limit: Flags.string({
      description: 'Limit execution to specific hosts or groups',
    }),

    // Aship behavior options
    'skip-vars': Flags.boolean({
      char: 'S',
      description: 'Skip variable configuration',
      default: false,
    }),
    yes: Flags.boolean({
      char: 'y',
      description: 'Skip all prompts and use defaults',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress all output except errors',
      default: false,
    }),
    debug: Flags.boolean({
      description: 'Enable debug mode',
      default: false,
    }),
    trace: Flags.boolean({
      description: 'Enable trace mode with maximum verbosity',
      default: false,
    }),
    timestamps: Flags.boolean({
      description: 'Show timestamps in log output',
      default: false,
    }),

    // Variable options
    'extra-vars': Flags.string({
      char: 'e',
      description: 'Extra variables (key=value,key2=value2)',
    }),

    // Ansible options (common ones)
    tags: Flags.string({
      description: 'Only run plays and tasks tagged with these values',
    }),
    'skip-tags': Flags.string({
      description: 'Only run plays and tasks whose tags do not match these values',
    }),
    check: Flags.boolean({
      description: 'Run in check mode (dry run)',
      default: false,
    }),
    diff: Flags.boolean({
      description: 'Show differences when changing files',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose mode',
      default: false,
    }),

    // Additional Ansible options
    step: Flags.boolean({
      description: 'One-step-at-a-time: confirm each task before running',
      default: false,
    }),
    'ask-become-pass': Flags.boolean({
      description: 'Ask for privilege escalation password',
      default: false,
    }),
    'become-user': Flags.string({
      description: 'Run operations as this user (default=root)',
    }),
    'vault-password-file': Flags.string({
      description: 'Vault password file',
    }),
    'ask-vault-pass': Flags.boolean({
      description: 'Ask for vault password',
      default: false,
    }),
    'start-at-task': Flags.string({
      description: 'Start the playbook at the task matching this name',
    }),
    'list-tasks': Flags.boolean({
      description: 'List all tasks that would be executed',
      default: false,
    }),
    'list-tags': Flags.boolean({
      description: 'List all available tags',
      default: false,
    }),
    timeout: Flags.string({
      description: 'Override the connection timeout in seconds',
    }),
    connection: Flags.string({
      description: 'Connection type to use',
    }),
    'ssh-common-args': Flags.string({
      description: 'Specify common arguments to pass to sftp/scp/ssh',
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Run);

    try {
      // Initialize configuration directory using DirectoryManager
      const directoryManager = new DirectoryManager();
      await directoryManager.initialize();

      // Check and update Ansible parameters
      await checkAndUpdateAnsibleParameters();

      // Configure logger based on flags
      this.configureLogger(flags);

      // Execute the run action
      await this.runAction(args.playbook, flags);
    } catch (error) {
      // Check if this is a user interruption (Ctrl+C)
      if (
        error instanceof Error &&
        (error.message.includes('User force closed') ||
          error.message.includes('SIGINT') ||
          error.message.includes('canceled') ||
          error.message.includes('cancelled'))
      ) {
        OCLIFFormatter.warning('Operation cancelled by user');
        this.exit(0);
      } else {
        OCLIFFormatter.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        this.exit(1);
      }
    }
  }

  public configureLogger(flags: any): void {
    // Set verbosity level
    if (flags.quiet) {
      logger.setLevel(LogLevel.ERROR);
    } else if (flags.trace) {
      logger.setLevel(LogLevel.TRACE);
    } else if (flags.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else {
      // Use default INFO level
      logger.setLevel(LogLevel.INFO);
    }

    // Enable timestamps if requested
    if (flags.timestamps) {
      logger.setTimestamps(true);
    }
  }

  public async runAction(playbookPath: string | undefined, flags: any): Promise<void> {
    const currentDir = process.cwd();

    // Load configuration
    const config = await loadConfiguration(currentDir);

    // Initialize aship components for host management
    const directoryManager = new DirectoryManager();
    const hostManager = new HostManager(directoryManager);
    const inventoryGenerator = new InventoryGenerator(hostManager);

    // Check if using enhanced mode (aship hosts or custom inventory)
    const useEnhancedMode = flags.hosts || flags.inventory || flags.limit;

    // Validate aship hosts if specified
    if (flags.hosts) {
      const hostNames = flags.hosts.split(',').map((h: string) => h.trim());
      await this.validateAshipHosts(hostNames, hostManager);
    }

    // Determine the playbook to use
    let resolvedPlaybookPath: string | undefined;
    try {
      // First try to resolve using new config format
      if (config.playbooks && Object.keys(config.playbooks).length > 0) {
        resolvedPlaybookPath = await this.resolvePlaybookPath(playbookPath, config);
      } else {
        // Fall back to old file resolution method
        resolvedPlaybookPath = await resolveFilePath(
          playbookPath,
          currentDir,
          PLAYBOOK_FILE_CONFIG,
          {
            nonInteractive: !!flags.yes,
            logger,
            promptFunction: inquirer.prompt,
          }
        );
      }

      if (!resolvedPlaybookPath) {
        logger.error('Error: No playbook path resolved.');
        this.exit(1);
      }
    } catch (error) {
      if (error instanceof PlaybookNotFoundError) {
        // Use the enhanced error message from our resolver
        logger.error(error.message);
      } else {
        logger.error(
          `Error resolving playbook path: ${error instanceof Error ? error.message : String(error)}`
        );
      }
      this.exit(1);
    }

    // Use enhanced mode if aship hosts or inventory options are specified
    if (useEnhancedMode) {
      if (!resolvedPlaybookPath) {
        throw new Error('Playbook path could not be resolved');
      }
      await this.runWithEnhancedMode(resolvedPlaybookPath, flags, config, {
        hostManager,
        inventoryGenerator,
        directoryManager,
        currentDir,
      });
      return;
    }

    // Fall back to traditional mode for backward compatibility
    if (!resolvedPlaybookPath) {
      throw new Error('Playbook path could not be resolved');
    }
    await this.runWithTraditionalMode(resolvedPlaybookPath, flags, config, {
      hostManager,
      inventoryGenerator,
      currentDir,
    });
  }

  /**
   * Resolve playbook path using new unified logic
   */
  private async resolvePlaybookPath(
    playbookName: string | undefined,
    config: ProjectConfig
  ): Promise<string> {
    // If no playbook name provided, try auto-selection
    if (!playbookName) {
      const autoSelected = autoSelectPlaybook(config);
      if (autoSelected) {
        // Auto-select single playbook
        const playbookPath = config.playbooks?.[autoSelected];
        if (!playbookPath) {
          throw new Error(`Playbook '${autoSelected}' not found in configuration`);
        }
        return playbookPath;
      }
      const playbooks = config.playbooks || {};
      const playbookNames = Object.keys(playbooks);

      if (playbookNames.length > 1) {
        // Multiple playbooks, prompt user to select
        const { selected } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selected',
            message: 'Select a playbook:',
            choices: playbookNames,
          },
        ]);
        return playbooks[selected];
      }
      throw new Error('No playbooks defined in configuration');
    }

    // Parse the input using new resolver
    const parsed = parsePlaybookInput(playbookName, config);
    return parsed.resolvedPath;
  }

  /**
   * Validate aship hosts exist
   */
  private async validateAshipHosts(hostNames: string[], hostManager: HostManager): Promise<void> {
    const allHosts = await hostManager.getHosts();
    const availableHostNames = allHosts.map(h => h.name);

    for (const hostName of hostNames) {
      if (!availableHostNames.includes(hostName)) {
        throw new Error(
          `Host '${hostName}' not found in aship configuration. Available hosts: ${availableHostNames.join(', ')}`
        );
      }
    }
  }

  /**
   * Run playbook using enhanced mode with PlaybookRunner
   */
  private async runWithEnhancedMode(
    playbookPath: string,
    flags: any,
    config: ProjectConfig,
    context: {
      hostManager: HostManager;
      inventoryGenerator: InventoryGenerator;
      directoryManager: DirectoryManager;
      currentDir: string;
    }
  ): Promise<void> {
    const { hostManager, inventoryGenerator, directoryManager, currentDir } = context;

    // Parse hosts if specified
    const hosts = flags.hosts ? flags.hosts.split(',').map((h: string) => h.trim()) : undefined;

    // Collect variables and tags
    const { variables, selectedTags } = await this.collectVariablesAndTags(config, flags);

    // Extract Ansible arguments
    const ansibleArgs = this.extractAllAnsibleArgs(flags, selectedTags);

    // Display command preview for enhanced mode
    this.displayEnhancedCommandPreview(playbookPath, ansibleArgs, variables, hosts, flags);

    // Check for dry-run mode (message already shown in command display)
    if (flags['dry-run']) {
      return;
    }

    // Record start time
    const startTime = Date.now();

    // Create PlaybookRunner
    const runner = new PlaybookRunner(hostManager, inventoryGenerator, directoryManager);

    try {
      // Execute playbook with enhanced options
      await runner.run(playbookPath, {
        hosts,
        inventory: flags.inventory,
        limit: flags.limit,
        inventoryMode: flags['inventory-mode'],
        vars: variables,
        ansibleArgs,
        cwd: currentDir,
        events: {
          onStdout: (data: string) => process.stdout.write(data),
          onStderr: (data: string) => process.stderr.write(data),
        },
      });

      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Display detailed completion report for success
      this.displayCompletionReport(
        true,
        hosts || [],
        playbookPath,
        undefined,
        undefined,
        executionTime
      );
    } catch (error) {
      // Calculate execution time
      const executionTime = Date.now() - startTime;

      // Extract exit code from error message if possible
      let exitCode: number | undefined;
      let stderr: string | undefined;

      if (error instanceof Error) {
        const match = error.message.match(/exit code (\d+)/);
        if (match) {
          exitCode = Number.parseInt(match[1], 10);
        }
        stderr = error.message;
      }

      // Display detailed completion report for failure
      this.displayCompletionReport(false, hosts, playbookPath, exitCode, stderr, executionTime);
      this.exit(1);
    }
  }

  /**
   * Run playbook using traditional mode for backward compatibility
   */
  private async runWithTraditionalMode(
    playbookPath: string,
    flags: any,
    config: ProjectConfig,
    context: {
      hostManager: HostManager;
      inventoryGenerator: InventoryGenerator;
      currentDir: string;
    }
  ): Promise<void> {
    const { currentDir } = context;

    // Use traditional server resolution
    const connectionMode = determineConnectionMode(flags, {});

    // Resolve target servers
    const result = await resolveTargetServers(config, {
      connectionMode,
      host: flags.host,
      user: flags.user,
      password: flags.password,
      key: flags.key,
      server: flags.server,
      nonInteractive: flags.yes,
    });

    const targetServers = result.targetServers;

    // Collect variables and tags
    const { variables, selectedTags } = await this.collectVariablesAndTags(config, flags);

    // Extract Ansible arguments
    const ansibleArgs = this.extractAllAnsibleArgs(flags, selectedTags);

    // Execute using traditional AnsibleExecutor
    const executor = new AnsibleExecutor();

    // Display execution section using OCLIF formatter
    OCLIFFormatter.section('Executing Playbook');
    OCLIFFormatter.info(`Playbook: ${playbookPath}`);

    // Display command preview using OCLIF formatter
    this.displayTraditionalCommandPreview(
      'ansible-playbook',
      playbookPath,
      ansibleArgs,
      variables,
      targetServers,
      flags
    );

    // Check for dry-run mode (message already shown in command display)
    if (flags['dry-run']) {
      return;
    }

    // Record start time
    const startTime = Date.now();

    // Start Ansible output section with improved styling
    this.displayAnsibleOutputHeader();

    const executionOptions = {
      servers: targetServers,
      playbook: playbookPath,
      extraVars: variables,
      ansibleArgs,
      cwd: currentDir,
      events: {
        onStdout: (data: string) => process.stdout.write(data),
        onStderr: (data: string) => process.stderr.write(data),
      },
    };

    const executionResult = await executor.executePlaybook(executionOptions);

    // Calculate execution time
    const executionTime = Date.now() - startTime;

    // End Ansible output section
    logger.ansibleSectionEnd();

    // Display result
    if (executionResult.success) {
      this.displayCompletionReport(
        true,
        targetServers,
        playbookPath,
        undefined,
        undefined,
        executionTime
      );
    } else {
      this.displayCompletionReport(
        false,
        targetServers,
        playbookPath,
        executionResult.exitCode,
        executionResult.stderr,
        executionTime
      );
      this.exit(1);
    }
  }

  /**
   * Collect variables and tags from configuration
   */
  private async collectVariablesAndTags(
    config: ProjectConfig,
    flags: any
  ): Promise<{ variables: Record<string, any>; selectedTags: string[] }> {
    // Parse extra vars
    const extraVars = parseExtraVars(flags['extra-vars']);

    // Collect tags first if configured
    let selectedTags: string[] = [];
    if (await shouldCollectTags(config, flags)) {
      selectedTags = await collectTagsFromConfig(config);
      if (selectedTags.length > 0) {
        OCLIFFormatter.info(`Selected tags: ${selectedTags.join(', ')}`);
      }
    }

    // Collect variables
    let variables: Record<string, any> = {};
    if (await this.shouldCollectVariables(config, flags)) {
      // For now, use empty existing vars - we can enhance this later
      variables = await collectVariablesFromConfig(config, {});
    }

    // Merge extra vars (they take precedence)
    variables = { ...variables, ...extraVars };

    return { variables, selectedTags };
  }

  /**
   * Determine if variables should be configured based on smart logic
   */
  private async shouldCollectVariables(config: ProjectConfig, flags: any): Promise<boolean> {
    // If explicitly skipping or using yes mode, don't configure
    if (flags['skip-vars'] || flags.yes) {
      return false;
    }

    // If no variables defined in config, no need to configure
    if (!config.vars || Object.keys(config.vars).length === 0) {
      return false;
    }

    // Default behavior: always configure variables for confirmation
    // Cached values will be used as defaults in the configuration process
    return true;
  }

  /**
   * Extract all Ansible arguments from flags and tags
   */
  private extractAllAnsibleArgs(flags: any, selectedTags: string[]): string[] {
    // 1. Extract from known common parameters
    const ansibleParams = loadCommonAnsibleParams();
    const knownAnsibleArgs = extractAnsibleArgsFromOptions(flags, ansibleParams);

    // 2. Extract from legacy extractAnsibleOptions (for backward compatibility)
    const legacyAnsibleArgs = extractAnsibleOptions(process.argv) || [];

    // 3. Merge all Ansible arguments
    const ansibleArgs = [...knownAnsibleArgs, ...legacyAnsibleArgs];

    // 4. Add collected tags
    if (selectedTags.length > 0) {
      ansibleArgs.push('--tags', selectedTags.join(','));
    }

    // 5. Add flags-specific ansible options
    if (flags.tags) {
      ansibleArgs.push('--tags', flags.tags);
    }
    if (flags['skip-tags']) {
      ansibleArgs.push('--skip-tags', flags['skip-tags']);
    }
    if (flags.check) {
      ansibleArgs.push('--check');
    }
    if (flags.diff) {
      ansibleArgs.push('--diff');
    }
    if (flags.verbose) {
      ansibleArgs.push('-v');
    }

    // Additional Ansible options
    if (flags.step) {
      ansibleArgs.push('--step');
    }
    if (flags['ask-become-pass']) {
      ansibleArgs.push('--ask-become-pass');
    }
    if (flags['become-user']) {
      ansibleArgs.push('--become-user', flags['become-user']);
    }
    if (flags['vault-password-file']) {
      ansibleArgs.push('--vault-password-file', flags['vault-password-file']);
    }
    if (flags['ask-vault-pass']) {
      ansibleArgs.push('--ask-vault-pass');
    }
    if (flags['start-at-task']) {
      ansibleArgs.push('--start-at-task', flags['start-at-task']);
    }
    if (flags['list-tasks']) {
      ansibleArgs.push('--list-tasks');
    }
    if (flags['list-tags']) {
      ansibleArgs.push('--list-tags');
    }
    if (flags.timeout) {
      ansibleArgs.push('--timeout', flags.timeout);
    }
    if (flags.connection) {
      ansibleArgs.push('--connection', flags.connection);
    }
    if (flags['ssh-common-args']) {
      ansibleArgs.push('--ssh-common-args', flags['ssh-common-args']);
    }

    // Remove duplicates while preserving order
    return this.deduplicateArgs(ansibleArgs);
  }

  /**
   * Remove duplicate arguments while preserving order
   */
  private deduplicateArgs(args: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      // For flags with values, consider both the flag and its value
      if (arg.startsWith('-') && i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const flagWithValue = `${arg}=${args[i + 1]}`;
        if (!seen.has(flagWithValue)) {
          seen.add(flagWithValue);
          result.push(arg, args[i + 1]);
        }
        i++; // Skip the value
      } else {
        // For standalone flags
        if (!seen.has(arg)) {
          seen.add(arg);
          result.push(arg);
        }
      }
    }

    return result;
  }

  /**
   * Display command preview for traditional mode
   */
  private displayTraditionalCommandPreview(
    command: string,
    playbookPath: string,
    ansibleArgs: string[],
    variables: Record<string, any>,
    targetServers: any[],
    flags: any
  ): void {
    // Display execution info
    OCLIFFormatter.info(`Target servers: ${targetServers.length} server(s)`);

    if (Object.keys(variables).length > 0) {
      OCLIFFormatter.info(`Variables: ${Object.keys(variables).length} variable(s)`);
    }

    // Build command preview
    const commandParts = [command];

    // Add inventory
    if (flags['show-full-command']) {
      commandParts.push('-i', '/tmp/aship-inventory-xxx'); // Would be real path
    } else {
      commandParts.push('-i', '<inventory>');
    }

    // Add variables
    if (Object.keys(variables).length > 0) {
      if (flags['show-full-command']) {
        commandParts.push('--extra-vars', `'${JSON.stringify(variables)}'`);
      } else {
        commandParts.push('--extra-vars', '<variables>');
      }
    }

    // Add ansible arguments
    commandParts.push(...ansibleArgs);

    // Add playbook path
    commandParts.push(playbookPath);

    // Use OCLIF formatter for command display
    OCLIFFormatter.command(commandParts, {
      dryRun: flags['dry-run'],
      showFullCommand: flags['show-full-command'],
    });
  }

  /**
   * Display command preview for enhanced mode
   */
  private displayEnhancedCommandPreview(
    playbookPath: string,
    ansibleArgs: string[],
    variables: Record<string, any>,
    hosts: string[] | undefined,
    flags: any
  ): void {
    // Display enhanced mode info using OCLIF formatter
    OCLIFFormatter.enhancedMode(hosts, flags.inventory, flags.limit);

    if (Object.keys(variables).length > 0) {
      OCLIFFormatter.info(`Variables: ${Object.keys(variables).length} variable(s)`);
    }

    // Build command preview
    const commandParts = ['ansible-playbook'];
    commandParts.push('-i', '<generated-inventory>');

    if (Object.keys(variables).length > 0) {
      commandParts.push('--extra-vars', `'${JSON.stringify(variables)}'`);
    }

    if (flags.limit) {
      commandParts.push('--limit', flags.limit);
    }

    commandParts.push(...ansibleArgs);
    commandParts.push(playbookPath);

    // Use OCLIF formatter for command display
    OCLIFFormatter.command(commandParts, {
      dryRun: flags['dry-run'],
      showFullCommand: flags['show-full-command'],
    });
  }

  /**
   * Display simple separator before Ansible output
   */
  private displayAnsibleOutputHeader(): void {
    // No separator or blank line needed
  }

  /**
   * Display detailed completion report
   */
  private displayCompletionReport(
    success: boolean,
    targets: any[],
    playbookPath: string,
    exitCode?: number,
    stderr?: string,
    executionTime?: number
  ): void {
    // Use OCLIF formatter for completion report
    OCLIFFormatter.completionReport(
      success,
      targets,
      playbookPath,
      executionTime,
      exitCode,
      stderr
    );
  }
}
