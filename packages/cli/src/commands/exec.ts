import {
  AnsibleExecutor,
  DirectoryManager,
  LogLevel,
  extractAnsibleOptions,
  logger,
} from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../utils/oclif-formatter.js';

// Import shared utilities
import {
  determineConnectionMode,
  loadConfiguration,
  resolveTargetServers,
} from '../shared/server-connection-manager.js';

export default class Exec extends Command {
  static override args = {
    pattern: Args.string({
      description: 'Host pattern to target (default: all)',
      required: false,
    }),
    module: Args.string({
      description: 'Module name to execute (default: command)',
      required: false,
    }),
  };

  static override description = 'Execute a single task on target servers (ansible command)';

  static override examples = [
    '<%= config.bin %> <%= command.id %> all command -a "uptime"',
    '<%= config.bin %> <%= command.id %> web setup -a "name=nginx state=present"',
    '<%= config.bin %> <%= command.id %> -m ping',
    '<%= config.bin %> <%= command.id %> -h 192.168.1.100 -m command -a "ls -la"',
    '<%= config.bin %> <%= command.id %> -s web-server -m service -a "name=nginx state=started"',
  ];

  static override flags = {
    // Connection options
    server: Flags.string({
      char: 's',
      description: 'Target server(s) to run on (comma-separated)',
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

    // Module options
    args: Flags.string({
      char: 'a',
      description: 'Module arguments',
    }),
    module: Flags.string({
      char: 'm',
      description: 'Module name (overrides module argument)',
    }),

    // Mode options
    interactive: Flags.boolean({
      description: 'Force interactive mode',
      default: false,
    }),
    'non-interactive': Flags.boolean({
      description: 'Run in non-interactive mode (requires all necessary options)',
      default: false,
    }),

    // Behavior options
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress all output except errors',
      default: false,
    }),
    debug: Flags.boolean({
      description: 'Enable debug mode',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Verbose mode',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Exec);

    try {
      // Initialize configuration directory using DirectoryManager
      const directoryManager = new DirectoryManager();
      await directoryManager.initialize();

      // Configure logger based on flags
      this.configureLogger(flags);

      // Execute the exec action
      await this.execAction(args, flags);
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

  private configureLogger(flags: any): void {
    // Set verbosity level
    if (flags.quiet) {
      logger.setLevel(LogLevel.ERROR);
    } else if (flags.debug) {
      logger.setLevel(LogLevel.DEBUG);
    } else {
      logger.setLevel(LogLevel.INFO);
    }
  }

  private async execAction(args: any, flags: any): Promise<void> {
    const currentDir = process.cwd();

    // Load configuration
    const config = await loadConfiguration(currentDir);

    // Determine connection mode
    const connectionMode = determineConnectionMode(flags, {});

    // Resolve target servers
    const result = await resolveTargetServers(config, {
      connectionMode,
      host: flags.host,
      user: flags.user,
      password: flags.password,
      key: flags.key,
      server: flags.server,
      nonInteractive: flags['non-interactive'],
    });

    const targetServers = result.targetServers;

    // Determine module and arguments
    let module = flags.module || args.module || 'command';
    let moduleArgs = flags.args || '';

    // If in interactive mode and no module/args specified, prompt for them
    if (!flags['non-interactive'] && !moduleArgs) {
      if (!args.module && !flags.module) {
        const moduleResponse = await inquirer.prompt([
          {
            type: 'input',
            name: 'module',
            message: 'Module name:',
            default: 'command',
          },
        ]);
        module = moduleResponse.module;
      }

      const argsResponse = await inquirer.prompt([
        {
          type: 'input',
          name: 'args',
          message: `Arguments for ${module} module:`,
        },
      ]);
      moduleArgs = argsResponse.args;
    }

    // Determine host pattern
    const hostPattern = args.pattern || 'all';

    // Create Ansible executor
    const executor = new AnsibleExecutor();

    // Extract Ansible options from command line arguments
    const ansibleArgs = extractAnsibleOptions(process.argv) || [];

    // Add verbose flag if specified
    if (flags.verbose) {
      ansibleArgs.push('-v');
    }

    // Display detailed execution information using OCLIF formatter
    OCLIFFormatter.info(
      `Executing ${module} module on ${hostPattern} with args: ${moduleArgs || '<none>'}`
    );

    // Build command preview
    const commandParts = ['ansible', hostPattern, '-i', '<temporary-inventory>', '-m', module];

    if (moduleArgs) {
      commandParts.push('-a', `"${moduleArgs}"`);
    }

    if (ansibleArgs.length > 0) {
      commandParts.push(...ansibleArgs);
    }

    // Display command preview using OCLIF formatter
    OCLIFFormatter.command(commandParts);

    // Start Ansible output section
    logger.ansibleSection('Ansible Output');

    const result_exec = await executor.executeAnsible({
      servers: targetServers,
      pattern: hostPattern,
      module,
      args: moduleArgs,
      ansibleArgs,
      cwd: currentDir,
      events: {
        onStdout: (data: string) => process.stdout.write(data),
        onStderr: (data: string) => process.stderr.write(data),
      },
    });

    // End Ansible output section
    logger.ansibleSectionEnd();

    // Display result using OCLIF formatter
    if (result_exec.success) {
      OCLIFFormatter.success('Ansible execution completed successfully');
    } else {
      OCLIFFormatter.error(
        'Ansible execution failed',
        result_exec.stderr?.trim(),
        result_exec.exitCode
      );

      this.exit(1);
    }
  }
}
