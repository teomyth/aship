import {
  DirectoryManager,
  HostManager,
  type InventoryFormat,
  InventoryGenerator,
  logger,
} from '@aship/core';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';

export default class InventoryGenerate extends Command {
  static override description = 'Generate Ansible inventory from aship hosts';

  static override aliases = ['inventory:gen', 'inventory:create'];

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --output inventory.yml',
    '<%= config.bin %> <%= command.id %> --format json',
    '<%= config.bin %> <%= command.id %> --filter "web-*"',
    '<%= config.bin %> <%= command.id %> --source manual',
    '<%= config.bin %> <%= command.id %> --group production_hosts',
    '<%= config.bin %> <%= command.id %> --include web-1,web-2 --exclude db-1',
  ];

  static override flags = {
    output: Flags.string({
      char: 'o',
      description: 'Output file path',
    }),
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
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed generation process',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress output messages',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(InventoryGenerate);

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
        console.log(chalk.cyan('Generating inventory...'));
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
        if (!flags.quiet) {
          console.log(chalk.yellow('No hosts found matching the specified criteria'));
        }
        return;
      }

      if (flags.output) {
        await generator.saveInventory(flags.output, inventory, flags.format as InventoryFormat);
        if (!flags.quiet) {
          console.log(chalk.green(`✓ Inventory saved to ${flags.output}`));
          console.log(chalk.gray(`  Generated ${hostCount} host(s) in group "${flags.group}"`));
        }
      } else {
        // Output to console
        const content = generator.formatInventory(inventory, flags.format as InventoryFormat);
        console.log(content);
      }

      if (flags.verbose && !flags.output) {
        console.log(chalk.gray(`\nGenerated ${hostCount} host(s) in group "${flags.group}"`));
      }
    } catch (error) {
      logger.error(
        `Error generating inventory: ${error instanceof Error ? error.message : String(error)}`
      );
      this.exit(1);
    }
  }
}
