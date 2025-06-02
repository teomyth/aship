import {
  DirectoryManager,
  HostManager,
  type InventoryFormat,
  InventoryGenerator,
  logger,
} from '@aship/core';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

export default class InventoryShow extends Command {
  static override description = 'Show generated inventory content';

  static override aliases = ['inventory:preview', 'inventory:view'];

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --format json',
    '<%= config.bin %> <%= command.id %> --filter "web-*"',
    '<%= config.bin %> <%= command.id %> --source manual',
    '<%= config.bin %> <%= command.id %> --group production_hosts',
    '<%= config.bin %> <%= command.id %> --hosts-only',
    '<%= config.bin %> <%= command.id %> --count',
  ];

  static override flags = {
    format: Flags.string({
      char: 'f',
      description: 'Output format (yaml|json)',
      default: 'yaml',
      options: ['yaml', 'json'],
    }),
    filter: Flags.string({
      char: 'F',
      description: 'Filter hosts by name pattern (regex)',
    }),
    source: Flags.string({
      char: 's',
      description: 'Filter by source (manual|ssh_config|imported)',
      options: ['manual', 'ssh_config', 'imported'],
    }),
    group: Flags.string({
      char: 'g',
      description: 'Custom group name for aship hosts',
      default: 'aship_hosts',
    }),
    include: Flags.string({
      description: 'Include only specific hosts (comma-separated)',
    }),
    exclude: Flags.string({
      description: 'Exclude specific hosts (comma-separated)',
    }),
    'hosts-only': Flags.boolean({
      description: 'Show only the hosts section',
      default: false,
    }),
    'groups-only': Flags.boolean({
      description: 'Show only the groups section',
      default: false,
    }),
    count: Flags.boolean({
      char: 'c',
      description: 'Show host count only',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed information',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(InventoryShow);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);
      const generator = new InventoryGenerator(hostManager);

      // Parse include/exclude lists
      const includeHosts = flags.include
        ? flags.include.split(',').map((h: string) => h.trim())
        : undefined;
      const excludeHosts = flags.exclude
        ? flags.exclude.split(',').map((h: string) => h.trim())
        : undefined;

      if (flags.verbose) {
        console.log(chalk.cyan('Generating inventory preview...'));
        if (flags.filter) {
          console.log(chalk.gray(`Filter pattern: ${flags.filter}`));
        }
        if (flags.source) {
          console.log(chalk.gray(`Source filter: ${flags.source}`));
        }
        if (includeHosts) {
          console.log(chalk.gray(`Include hosts: ${includeHosts.join(', ')}`));
        }
        if (excludeHosts) {
          console.log(chalk.gray(`Exclude hosts: ${excludeHosts.join(', ')}`));
        }
        console.log();
      }

      const inventory = await generator.generateInventory({
        filter: flags.filter,
        source: flags.source as 'manual' | 'ssh_config' | 'imported' | undefined,
        groupName: flags.group,
        includeHosts,
        excludeHosts,
      });

      // Check if any hosts were found
      const hostCount = Object.keys(inventory.all.hosts).length;
      if (hostCount === 0) {
        console.log(chalk.yellow('No hosts found matching the specified criteria'));
        return;
      }

      if (flags.count) {
        console.log(hostCount);
        return;
      }

      let outputContent: any = inventory;

      // Filter output based on options
      if (flags['hosts-only']) {
        outputContent = { hosts: inventory.all.hosts };
      } else if (flags['groups-only']) {
        outputContent = { groups: inventory.all.children };
      }

      const content = generator.formatInventory(outputContent, flags.format as InventoryFormat);
      console.log(content);

      if (flags.verbose) {
        console.log();
        console.log(chalk.gray(`Generated ${hostCount} host(s) in group "${flags.group}"`));

        // Show host summary
        const hostNames = Object.keys(inventory.all.hosts);
        if (hostNames.length <= 10) {
          console.log(chalk.gray(`Hosts: ${hostNames.join(', ')}`));
        } else {
          console.log(
            chalk.gray(
              `Hosts: ${hostNames.slice(0, 10).join(', ')} ... and ${hostNames.length - 10} more`
            )
          );
        }
      }
    } catch (error) {
      logger.error(
        `Error showing inventory: ${error instanceof Error ? error.message : String(error)}`
      );
      this.exit(1);
    }
  }
}
