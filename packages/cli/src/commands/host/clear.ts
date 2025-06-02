import { DirectoryManager, HostManager } from '@aship/core';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostClear extends Command {
  static override description = 'Clear host-related data (usage history, recent connections)';

  static override aliases = ['host:clean', 'host:reset', 'host:purge'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> --usage',
    '<%= config.bin %> <%= command.id %> --recent',
    '<%= config.bin %> <%= command.id %> --all',
    '<%= config.bin %> <%= command.id %> --usage --force',
    '<%= config.bin %> host clean --all -f',
    '<%= config.bin %> host reset --usage',
  ];

  static override flags = {
    usage: Flags.boolean({
      char: 'u',
      description: 'Clear usage history for all hosts',
      default: false,
    }),
    recent: Flags.boolean({
      char: 'r',
      description: 'Clear recent connection data',
      default: false,
    }),
    all: Flags.boolean({
      char: 'a',
      description: 'Clear all host-related data (usage + recent)',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Skip confirmation prompt',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(HostClear);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      // Validate flags
      if (!flags.usage && !flags.recent && !flags.all) {
        OCLIFFormatter.error('Please specify what to clear: --usage, --recent, or --all');
        this.exit(1);
      }

      // Determine what to clear
      const clearUsage = flags.usage || flags.all;
      const clearRecent = flags.recent || flags.all;

      // Show what will be cleared
      const actions: string[] = [];
      if (clearUsage) actions.push('usage history');
      if (clearRecent) actions.push('recent connections');

      console.log(chalk.yellow('⚠️  This will clear the following data:'));
      for (const action of actions) {
        console.log(`   • ${action}`);
      }
      console.log();

      // Confirmation prompt (unless --force is used)
      if (!flags.force) {
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: `Are you sure you want to clear ${actions.join(' and ')}?`,
            default: false,
          },
        ]);

        if (!answer.confirm) {
          OCLIFFormatter.info('Operation cancelled.');
          return;
        }
      }

      let clearedItems = 0;

      // Clear usage history
      if (clearUsage) {
        try {
          const usageHistory = await hostManager.getUsageHistory();
          const usageCount = Object.keys(usageHistory).length;

          if (usageCount > 0) {
            // Clear by saving empty usage history
            await this.clearUsageHistory(directoryManager);
            OCLIFFormatter.success(`Cleared usage history for ${usageCount} host(s)`);
            clearedItems++;
          } else {
            OCLIFFormatter.info('No usage history to clear');
          }
        } catch (error) {
          OCLIFFormatter.error(
            'Failed to clear usage history',
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      // Clear recent connections
      if (clearRecent) {
        try {
          const recent = await hostManager.getRecentConnection();

          if (recent) {
            await hostManager.clearRecentConnection();
            OCLIFFormatter.success('Cleared recent connection data');
            clearedItems++;
          } else {
            OCLIFFormatter.info('No recent connection data to clear');
          }
        } catch (error) {
          OCLIFFormatter.error(
            'Failed to clear recent connections',
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      // Summary
      if (clearedItems > 0) {
        console.log();
        OCLIFFormatter.success(`Successfully cleared ${clearedItems} data type(s)`);

        // Show what remains
        const hosts = await hostManager.getHosts();
        if (hosts.length > 0) {
          OCLIFFormatter.info(
            `${hosts.length} host configuration(s) remain unchanged. Use "aship host list" to view them.`
          );
        }
      } else {
        OCLIFFormatter.info('No data was cleared (nothing to clear)');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to clear host data', errorMessage);
      this.exit(1);
    }
  }

  private async clearUsageHistory(directoryManager: DirectoryManager): Promise<void> {
    const fs = await import('node:fs/promises');

    try {
      // Write empty usage history
      const emptyUsage = {};
      const jsonContent = JSON.stringify(emptyUsage, null, 2);
      await fs.writeFile(directoryManager.hostUsageFile, jsonContent, 'utf-8');
    } catch (error) {
      // If file doesn't exist, that's fine - it's already "cleared"
      if (error instanceof Error && 'code' in error && error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
