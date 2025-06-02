import { DirectoryManager, HostManager } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';
import { formatDateTime, formatRelativeDateTime } from '../../utils/time-formatter.js';

export default class HostShow extends Command {
  static override description = 'Show detailed information about a host';

  static override aliases = ['host:info', 'host:get', 'host:describe'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> web-server',
    '<%= config.bin %> <%= command.id %> web-server --usage',
    '<%= config.bin %> <%= command.id %> --interactive',
    '<%= config.bin %> <%= command.id %> web-server --format json',
    '<%= config.bin %> host info web-server',
    '<%= config.bin %> host get web-server -u',
  ];

  static override args = {
    name: Args.string({
      description: 'Name of the host to show',
      required: false,
    }),
  };

  static override flags = {
    interactive: Flags.boolean({
      char: 'i',
      description: 'Select host interactively',
      default: false,
    }),
    usage: Flags.boolean({
      char: 'u',
      description: 'Show usage statistics',
      default: false,
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format (table|json)',
      default: 'table',
      options: ['table', 'json'],
    }),
    'relative-time': Flags.boolean({
      char: 'r',
      description: 'Show relative time (e.g., "2 hours ago") instead of absolute time',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(HostShow);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

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
            message: 'Select host to show:',
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

      // Get usage statistics if requested
      let usage: any = null;
      if (flags.usage) {
        const usageHistory = await hostManager.getUsageHistory();
        usage = usageHistory[hostName];
      }

      if (flags.format === 'json') {
        const output = {
          host,
          ...(usage && { usage }),
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Display in table format
      this.displayHostInfo(host, usage, flags);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to show host information', errorMessage);
      this.exit(1);
    }
  }

  private displayHostInfo(host: any, usage: any, flags: any): void {
    const timeFormatter = flags['relative-time'] ? formatRelativeDateTime : formatDateTime;

    // Basic host information
    console.log(chalk.cyan.bold(`Host: ${host.name}`));
    console.log();

    const basicInfo = [
      { label: 'Name', value: host.name },
      { label: 'Hostname', value: host.hostname },
      { label: 'User', value: host.user },
      { label: 'Port', value: host.port.toString() },
    ];

    if (host.identity_file) {
      basicInfo.push({ label: 'SSH Key', value: host.identity_file });
    }

    if (host.description) {
      basicInfo.push({ label: 'Description', value: host.description });
    }

    basicInfo.push(
      { label: 'Source', value: host.source },
      { label: 'Created', value: timeFormatter(host.created_at) }
    );

    if (host.connection_success_at) {
      basicInfo.push({ label: 'First Success', value: timeFormatter(host.connection_success_at) });
    }

    OCLIFFormatter.table(basicInfo);

    // Connection string
    const userInfo = host.user ? `${host.user}@` : '';
    const portInfo = host.port !== 22 ? ` -p ${host.port}` : '';
    const keyInfo = host.identity_file ? ` -i ${host.identity_file}` : '';

    console.log();
    console.log(chalk.gray('SSH Command:'));
    console.log(chalk.white(`ssh ${userInfo}${host.hostname}${portInfo}${keyInfo}`));

    // Usage statistics
    if (usage) {
      console.log();
      console.log(chalk.cyan.bold('Usage Statistics:'));
      console.log();

      const usageInfo = [
        { label: 'First Used', value: timeFormatter(usage.first_used) },
        { label: 'Last Used', value: timeFormatter(usage.last_used) },
        { label: 'Use Count', value: usage.use_count.toString() },
      ];

      OCLIFFormatter.table(usageInfo);
    }

    // Ansible inventory format
    console.log();
    console.log(chalk.gray('Ansible Inventory Format:'));
    const ansibleHost = `${host.name} ansible_host=${host.hostname} ansible_user=${host.user}`;
    const ansiblePort = host.port !== 22 ? ` ansible_port=${host.port}` : '';
    const ansibleKey = host.identity_file
      ? ` ansible_ssh_private_key_file=${host.identity_file}`
      : '';

    console.log(chalk.white(`${ansibleHost}${ansiblePort}${ansibleKey}`));
  }
}
