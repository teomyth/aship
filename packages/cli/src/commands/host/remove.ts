import { DirectoryManager, HostManager } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostRemove extends Command {
  static override description = 'Remove a host from Aship';

  static override aliases = ['host:rm', 'host:delete', 'host:del'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> web-server',
    '<%= config.bin %> <%= command.id %> 1',
    '<%= config.bin %> <%= command.id %> web-server --force',
    '<%= config.bin %> <%= command.id %> --interactive',
    '<%= config.bin %> host rm web-server',
    '<%= config.bin %> host del web-server -f',
  ];

  static override args = {
    name: Args.string({
      description: 'Name of the host to remove',
      required: false,
    }),
  };

  static override flags = {
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation prompt',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Select host interactively',
      default: false,
    }),
    'keep-usage': Flags.boolean({
      description: 'Keep usage history when removing host',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(HostRemove);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      let hostName = args.name;
      const hosts = await hostManager.getHosts();

      if (hosts.length === 0) {
        OCLIFFormatter.info('No hosts configured. Use "aship host add" to add a host.');
        return;
      }

      // Check if user provided a number (index) instead of host name
      if (hostName && /^\d+$/.test(hostName)) {
        const index = Number.parseInt(hostName, 10);
        if (index > 0 && index <= hosts.length) {
          // Convert index to actual host name (using 1-based indexing as displayed)
          hostName = hosts[index - 1].name;
        } else {
          OCLIFFormatter.error(`Invalid host index: ${hostName}. Valid range: 1-${hosts.length}`);
          this.exit(1);
        }
      }

      // Interactive mode or no host name provided
      if (flags.interactive || !hostName) {
        const hosts = await hostManager.getHosts();

        if (hosts.length === 0) {
          OCLIFFormatter.info('No hosts configured. Use "aship host add" to add a host.');
          return;
        }

        const choices = hosts.map((host, index) => ({
          name: `[${index + 1}] ${host.name} (${host.user ? `${host.user}@` : ''}${host.hostname}${host.port !== 22 ? `:${host.port}` : ''})`,
          value: host.name,
        }));

        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'hostName',
            message: 'Select host to remove:',
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

      // Check if host exists
      const host = await hostManager.getHost(hostName);
      if (!host) {
        OCLIFFormatter.error(`Host "${hostName}" not found.`);
        this.exit(1);
      }

      // Confirmation prompt (unless --force is used)
      if (!flags.force) {
        const userInfo = host.user ? `${host.user}@` : '';
        const portInfo = host.port !== 22 ? `:${host.port}` : '';

        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to remove host "${hostName}" (${userInfo}${host.hostname}${portInfo})?`,
            default: false,
          },
        ]);

        if (!answer.confirm) {
          OCLIFFormatter.info('Operation cancelled.');
          return;
        }
      }

      // Remove the host
      await hostManager.removeHost(hostName);

      // Handle usage history
      if (flags['keep-usage']) {
        OCLIFFormatter.info('Usage history preserved.');
      }

      OCLIFFormatter.success(`Host "${hostName}" removed successfully!`);

      // Show remaining hosts count
      const remainingHosts = await hostManager.getHosts();
      if (remainingHosts.length > 0) {
        OCLIFFormatter.info(
          `${remainingHosts.length} host(s) remaining. Use "aship host list" to view them.`
        );
      } else {
        OCLIFFormatter.info('No hosts remaining. Use "aship host add" to add a new host.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to remove host', errorMessage);
      this.exit(1);
    }
  }
}
