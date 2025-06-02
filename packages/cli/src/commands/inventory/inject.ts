import { DirectoryManager, HostManager, type InjectOptions, InventoryGenerator } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class InventoryInject extends Command {
  static override args = {
    file: Args.string({
      description: 'Inventory file to inject hosts into',
      required: true,
    }),
  };

  static override description = 'Inject aship hosts into existing inventory file';

  static override aliases = ['inventory:merge', 'inventory:add'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> inventory.yml',
    '<%= config.bin %> <%= command.id %> inventory.yml --backup',
    '<%= config.bin %> <%= command.id %> inventory.yml --dry-run',
    '<%= config.bin %> <%= command.id %> inventory.yml --group production_hosts',
    '<%= config.bin %> <%= command.id %> inventory.yml --filter "web-*"',
    '<%= config.bin %> <%= command.id %> inventory.yml --source manual',
    '<%= config.bin %> <%= command.id %> inventory.yml --include web-1,web-2',
    '<%= config.bin %> <%= command.id %> inventory.yml --force',
  ];

  static override flags = {
    backup: Flags.boolean({
      char: 'b',
      description: 'Create backup of original file',
      default: false,
    }),
    'dry-run': Flags.boolean({
      char: 'n',
      description: 'Show what would be changed without modifying file',
      default: false,
    }),
    group: Flags.string({
      char: 'g',
      description: 'Group name for injected hosts',
      default: 'aship_hosts',
    }),
    filter: Flags.string({
      char: 'F',
      description: 'Filter hosts to inject by name pattern (regex)',
    }),
    source: Flags.string({
      char: 's',
      description: 'Filter by source (manual|ssh_config|imported)',
      options: ['manual', 'ssh_config', 'imported'],
    }),
    include: Flags.string({
      description: 'Include only specific hosts (comma-separated)',
    }),
    exclude: Flags.string({
      description: 'Exclude specific hosts (comma-separated)',
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing hosts in inventory',
      default: false,
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed injection process',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Suppress output messages',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(InventoryInject);

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

      const injectOptions: InjectOptions = {
        groupName: flags.group,
        filter: flags.filter,
        source: flags.source as 'manual' | 'ssh_config' | 'imported' | undefined,
        includeHosts,
        excludeHosts,
        force: flags.force,
        backup: flags.backup,
        dryRun: flags['dry-run'],
      };

      if (flags.verbose) {
        console.log(chalk.cyan(`Injecting aship hosts into ${args.file}...`));
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
        console.log(chalk.gray(`Group name: ${flags.group}`));
        console.log(chalk.gray(`Force overwrite: ${flags.force}`));
        console.log();
      }

      // Preview changes first
      const preview = await generator.previewInjection(args.file, injectOptions);

      if (flags.verbose || flags['dry-run']) {
        console.log(chalk.bold('Injection Preview:'));
        console.log('─'.repeat(50));

        if (preview.hostsToAdd.length > 0) {
          console.log(chalk.green(`✓ Hosts to add (${preview.hostsToAdd.length}):`));
          preview.hostsToAdd.forEach(host => {
            console.log(`  + ${host}`);
          });
        }

        if (preview.hostsToUpdate.length > 0) {
          if (flags.force) {
            console.log(chalk.yellow(`⚠ Hosts to update (${preview.hostsToUpdate.length}):`));
            preview.hostsToUpdate.forEach(host => {
              console.log(`  ~ ${host}`);
            });
          } else {
            console.log(
              chalk.red(`✗ Hosts that would conflict (${preview.hostsToUpdate.length}):`)
            );
            preview.hostsToUpdate.forEach(host => {
              console.log(`  ! ${host} (use --force to overwrite)`);
            });
          }
        }

        if (preview.groupsToCreate.length > 0) {
          console.log(chalk.cyan(`+ Groups to create (${preview.groupsToCreate.length}):`));
          preview.groupsToCreate.forEach(group => {
            console.log(`  + ${group}`);
          });
        }

        console.log('─'.repeat(50));

        const totalChanges =
          preview.hostsToAdd.length + preview.hostsToUpdate.length + preview.groupsToCreate.length;
        if (totalChanges === 0) {
          console.log(chalk.gray('No changes would be made'));
        } else {
          console.log(chalk.cyan(`Total changes: ${totalChanges}`));
        }

        if (flags['dry-run']) {
          return;
        }
      }

      await generator.injectToInventory(args.file, injectOptions);

      if (!flags.quiet) {
        OCLIFFormatter.success(`Successfully injected aship hosts into ${args.file}`);

        if (flags.backup) {
          OCLIFFormatter.info(`Backup created: ${args.file}.backup`);
        }
      }

      if (flags.verbose) {
        // Show summary of what was done
        const finalPreview = await generator.previewInjection(args.file, {
          ...injectOptions,
          force: true,
        });
        const addedCount = finalPreview.hostsToAdd.length;
        const updatedCount = flags.force ? finalPreview.hostsToUpdate.length : 0;

        OCLIFFormatter.info(`Added ${addedCount} host(s), updated ${updatedCount} host(s)`);
      }
    } catch (error) {
      OCLIFFormatter.error(
        'Error injecting inventory',
        error instanceof Error ? error.message : String(error)
      );
      this.exit(1);
    }
  }
}
