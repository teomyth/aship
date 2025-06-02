import { DirectoryManager, HostManager, testConnection } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostTest extends Command {
  static override description = 'Test connection to a host';

  static override aliases = ['host:ping', 'host:check', 'host:connect'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> web-server',
    '<%= config.bin %> <%= command.id %> web-server --verbose',
    '<%= config.bin %> <%= command.id %> --interactive',
    '<%= config.bin %> <%= command.id %> --all',
    '<%= config.bin %> host ping web-server',
    '<%= config.bin %> host check --all -v',
  ];

  static override args = {
    name: Args.string({
      description: 'Name of the host to test',
      required: false,
    }),
  };

  static override flags = {
    interactive: Flags.boolean({
      char: 'i',
      description: 'Select host interactively',
      default: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Test all configured hosts',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed connection information',
      default: false,
    }),
    timeout: Flags.integer({
      char: 't',
      description: 'Connection timeout in seconds',
      default: 10,
    }),
    'update-usage': Flags.boolean({
      description: 'Update usage statistics on successful connection',
      default: true,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(HostTest);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      if (flags.all) {
        await this.testAllHosts(hostManager, flags);
        return;
      }

      let hostName = args.name;

      // Interactive mode or no host name provided
      if (flags.interactive || !hostName) {
        const hosts = await hostManager.getHosts();

        if (hosts.length === 0) {
          OCLIFFormatter.info('No hosts configured. Use "aship host add" to add a host.');
          return;
        }

        const choices = hosts.map(host => ({
          name: `${host.name} (${host.user ? `${host.user}@` : ''}${host.hostname}${host.port !== 22 ? `:${host.port}` : ''})`,
          value: host.name,
        }));

        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'hostName',
            message: 'Select host to test:',
            choices,
          },
        ]);

        hostName = answer.hostName;
      }

      if (!hostName) {
        OCLIFFormatter.error(
          'Host name is required. Use --interactive to select from available hosts.'
        );
        this.exit(1);
      }

      // Get host configuration
      const host = await hostManager.getHost(hostName);
      if (!host) {
        OCLIFFormatter.error(`Host "${hostName}" not found.`);
        this.exit(1);
      }

      await this.testSingleHost(host, hostManager, flags);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to test host connection', errorMessage);
      this.exit(1);
    }
  }

  private async testSingleHost(host: any, hostManager: HostManager, flags: any): Promise<void> {
    const userInfo = host.user ? `${host.user}@` : '';
    const portInfo = host.port !== 22 ? `:${host.port}` : '';

    OCLIFFormatter.info(
      `Testing connection to ${host.name} (${userInfo}${host.hostname}${portInfo})...`
    );

    const startTime = Date.now();

    try {
      const result = await testConnection({
        name: host.name,
        hostname: host.hostname,
        port: host.port,
        user: host.user,
        identity_file: host.identity_file,
      });

      const duration = Date.now() - startTime;

      if (result.success) {
        OCLIFFormatter.success(`Connection successful! (${duration}ms)`);

        if (flags.verbose) {
          const details = [
            { label: 'Method', value: result.method || 'unknown' },
            { label: 'Duration', value: `${duration}ms` },
          ];

          if (result.keyPath) {
            details.push({ label: 'Key', value: result.keyPath });
          }

          OCLIFFormatter.table(details);
        }

        // Update usage statistics if enabled
        if (flags['update-usage']) {
          await hostManager.updateUsage(host.name);
        }
      } else {
        OCLIFFormatter.error(`Connection failed: ${result.message}`);

        if (flags.verbose && result.message) {
          console.log(chalk.gray('\nDetailed error information:'));
          console.log(chalk.red(result.message));
        }

        this.exit(1);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      OCLIFFormatter.error(`Connection failed after ${duration}ms: ${errorMessage}`);
      this.exit(1);
    }
  }

  private async testAllHosts(hostManager: HostManager, flags: any): Promise<void> {
    const hosts = await hostManager.getHosts();

    if (hosts.length === 0) {
      OCLIFFormatter.info('No hosts configured. Use "aship host add" to add a host.');
      return;
    }

    OCLIFFormatter.info(`Testing connection to ${hosts.length} host(s)...`);
    console.log();

    const results: Array<{ name: string; success: boolean; duration: number; message?: string }> =
      [];

    for (const host of hosts) {
      const startTime = Date.now();

      try {
        const result = await testConnection({
          name: host.name,
          hostname: host.hostname,
          port: host.port,
          user: host.user,
          identity_file: host.identity_file,
        });

        const duration = Date.now() - startTime;

        results.push({
          name: host.name,
          success: result.success,
          duration,
          message: result.success ? undefined : result.message,
        });

        const status = result.success ? chalk.green('✓') : chalk.red('✗');
        const userInfo = host.user ? `${host.user}@` : '';
        const portInfo = host.port !== 22 ? `:${host.port}` : '';

        console.log(
          `${status} ${host.name} (${userInfo}${host.hostname}${portInfo}) - ${duration}ms`
        );

        if (!result.success && flags.verbose) {
          console.log(chalk.gray(`  Error: ${result.message}`));
        }

        // Update usage statistics for successful connections
        if (result.success && flags['update-usage']) {
          await hostManager.updateUsage(host.name);
        }
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : String(error);

        results.push({
          name: host.name,
          success: false,
          duration,
          message: errorMessage,
        });

        console.log(`${chalk.red('✗')} ${host.name} - ${duration}ms`);
        if (flags.verbose) {
          console.log(chalk.gray(`  Error: ${errorMessage}`));
        }
      }
    }

    // Summary
    console.log();
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;

    if (successful === results.length) {
      OCLIFFormatter.success(`All ${successful} host(s) connected successfully!`);
    } else if (successful > 0) {
      OCLIFFormatter.info(`${successful} host(s) connected successfully, ${failed} failed.`);
    } else {
      OCLIFFormatter.error(`All ${failed} host(s) failed to connect.`);
      this.exit(1);
    }
  }
}
