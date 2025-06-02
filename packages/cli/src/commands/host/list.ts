import { DirectoryManager, HostManager, logger } from '@aship/core';
import { Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

// Import utility functions
import { formatDateTime, formatRelativeDateTime } from '../../utils/time-formatter.js';

export default class HostList extends Command {
  static override description = 'List all configured hosts';

  static override aliases = ['host:ls', 'hosts'];

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --usage',
    '<%= config.bin %> <%= command.id %> --source manual',
    '<%= config.bin %> <%= command.id %> --format json',
    '<%= config.bin %> <%= command.id %> --verbose',
    '<%= config.bin %> <%= command.id %> --quiet',
    '<%= config.bin %> host ls',
    '<%= config.bin %> hosts -u',
  ];

  static override flags = {
    usage: Flags.boolean({
      char: 'u',
      description: 'Show usage statistics',
      default: false,
    }),
    source: Flags.string({
      char: 's',
      description: 'Filter by source (manual|ssh_config|imported)',
      options: ['manual', 'ssh_config', 'imported'],
    }),
    format: Flags.string({
      char: 'f',
      description: 'Output format (table|json)',
      default: 'table',
      options: ['table', 'json'],
    }),
    verbose: Flags.boolean({
      char: 'v',
      description: 'Show detailed information',
      default: false,
    }),
    quiet: Flags.boolean({
      char: 'q',
      description: 'Show only host names',
      default: false,
    }),
    'relative-time': Flags.boolean({
      char: 'r',
      description: 'Show relative time (e.g., "2 hours ago") instead of absolute time',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(HostList);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      // Get hosts and usage data
      const hosts = await hostManager.getHosts();
      const usage = flags.usage ? await hostManager.getUsageHistory() : {};

      // Filter by source if specified
      const filteredHosts = flags.source
        ? hosts.filter(host => host.source === flags.source)
        : hosts;

      if (filteredHosts.length === 0) {
        const sourceFilter = flags.source ? ` with source "${flags.source}"` : '';
        OCLIFFormatter.info(
          `No hosts configured${sourceFilter}. Use "aship host add" to add a host.`
        );
        return;
      }

      // Output in JSON format if requested
      if (flags.format === 'json') {
        const output = flags.usage
          ? filteredHosts.map(host => ({
              ...host,
              usage: usage[host.name] || null,
            }))
          : filteredHosts;
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // Quiet mode - only host names
      if (flags.quiet) {
        filteredHosts.forEach(host => console.log(host.name));
        return;
      }

      // Table format output using OCLIF formatter
      OCLIFFormatter.section('Configured Hosts');

      // Sort hosts by last used (most recent first) if usage is available
      const sortedHosts = flags.usage
        ? filteredHosts.sort((a, b) => {
            const aLastUsed = usage[a.name]?.last_used || '0';
            const bLastUsed = usage[b.name]?.last_used || '0';
            return bLastUsed.localeCompare(aLastUsed);
          })
        : filteredHosts.sort((a, b) => a.name.localeCompare(b.name));

      for (let i = 0; i < sortedHosts.length; i++) {
        const host = sortedHosts[i];
        const userInfo = host.user ? `${host.user}@` : '';
        const portInfo = host.port && host.port !== 22 ? `:${host.port}` : '';
        const hostUsage = usage[host.name];
        const indexDisplay = chalk.yellow(`[${i + 1}]`);

        console.log(`${indexDisplay} ${chalk.cyan.bold(host.name)}`);
        console.log(`  ${chalk.gray('Address:')} ${userInfo}${host.hostname}${portInfo}`);

        if (flags.verbose) {
          console.log(`  ${chalk.gray('Source:')} ${host.source}`);
          const timeFormatter = flags['relative-time'] ? formatRelativeDateTime : formatDateTime;
          console.log(`  ${chalk.gray('Created:')} ${timeFormatter(host.created_at)}`);
          if (host.identity_file) {
            console.log(`  ${chalk.gray('Key:')} ${host.identity_file}`);
          }
          if (host.description) {
            console.log(`  ${chalk.gray('Description:')} ${host.description}`);
          }
        }

        if (flags.usage && hostUsage) {
          const timeFormatter = flags['relative-time'] ? formatRelativeDateTime : formatDateTime;
          console.log(`  ${chalk.gray('Usage:')} ${hostUsage.use_count} times`);
          console.log(
            `  ${chalk.gray('Last used:')} ${hostUsage.last_used ? timeFormatter(hostUsage.last_used) : 'never'}`
          );
        }

        console.log('');
      }

      // Show recent connection if available
      const recent = await hostManager.getRecentConnection();
      if (recent && !flags.quiet) {
        const recentUserInfo = recent.user ? `${recent.user}@` : '';
        const recentPortInfo = recent.port && recent.port !== 22 ? `:${recent.port}` : '';
        const statusIcon = recent.lastConnectionSuccess ? '✅' : '❌';
        const timeFormatter = flags['relative-time'] ? formatRelativeDateTime : formatDateTime;

        const recentItems = [
          {
            label: 'Host',
            value: `${statusIcon} ${recentUserInfo}${recent.host}${recentPortInfo}`,
          },
          {
            label: 'Last attempt',
            value: recent.lastConnectionAttempt
              ? timeFormatter(recent.lastConnectionAttempt)
              : 'never',
          },
          { label: 'Attempts', value: recent.connectionAttempts.toString() },
        ];

        OCLIFFormatter.summary('Recent Connection', recentItems);
      }

      // Summary
      if (!flags.quiet) {
        const totalHosts = filteredHosts.length;
        const sourceFilter = flags.source ? ` (${flags.source})` : '';
        OCLIFFormatter.info(
          `Total: ${totalHosts} host${totalHosts !== 1 ? 's' : ''}${sourceFilter}`
        );
      }
    } catch (error) {
      logger.error(
        `Failed to list hosts: ${error instanceof Error ? error.message : String(error)}`
      );
      this.exit(1);
    }
  }
}
