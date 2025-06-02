import { DirectoryManager, HostManager, testConnection } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostEdit extends Command {
  static override description = 'Edit an existing host configuration';

  static override aliases = ['host:update', 'host:modify', 'host:change'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> web-server',
    '<%= config.bin %> <%= command.id %> web-server --hostname new.example.com',
    '<%= config.bin %> <%= command.id %> --interactive',
    '<%= config.bin %> <%= command.id %> web-server --test',
    '<%= config.bin %> host update web-server --hostname new.example.com',
    '<%= config.bin %> host modify web-server -i',
  ];

  static override args = {
    name: Args.string({
      description: 'Name of the host to edit',
      required: false,
    }),
  };

  static override flags = {
    interactive: Flags.boolean({
      char: 'i',
      description: 'Select host interactively',
      default: false,
    }),
    hostname: Flags.string({
      description: 'New hostname (IP or hostname)',
    }),
    port: Flags.string({
      description: 'New SSH port',
    }),
    user: Flags.string({
      description: 'New SSH username',
    }),
    'identity-file': Flags.string({
      description: 'New path to SSH identity file',
    }),
    description: Flags.string({
      description: 'New host description',
    }),
    'non-interactive': Flags.boolean({
      description: 'Run in non-interactive mode (requires specific field flags)',
      default: false,
    }),
    test: Flags.boolean({
      description: 'Test connection after editing',
      default: false,
    }),
    'clear-identity': Flags.boolean({
      description: 'Clear the SSH identity file',
      default: false,
    }),
    'clear-description': Flags.boolean({
      description: 'Clear the host description',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(HostEdit);

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
            message: 'Select host to edit:',
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

      // Get current host configuration
      const currentHost = await hostManager.getHost(hostName);
      if (!currentHost) {
        OCLIFFormatter.error(`Host "${hostName}" not found.`);
        this.exit(1);
      }

      // Show current configuration
      console.log(chalk.cyan.bold(`Editing host: ${hostName}`));
      console.log();
      console.log(chalk.gray('Current configuration:'));

      const currentInfo = [
        { label: 'Hostname', value: currentHost.hostname },
        { label: 'User', value: currentHost.user },
        { label: 'Port', value: currentHost.port.toString() },
        { label: 'SSH Key', value: currentHost.identity_file || '(none)' },
        { label: 'Description', value: currentHost.description || '(none)' },
      ];

      OCLIFFormatter.table(currentInfo);
      console.log();

      let updatedData: any = {};

      if (flags['non-interactive']) {
        // Non-interactive mode: use provided flags
        if (flags.hostname) updatedData.hostname = flags.hostname;
        if (flags.port) updatedData.port = Number.parseInt(flags.port, 10);
        if (flags.user) updatedData.user = flags.user;
        if (flags['identity-file']) updatedData.identity_file = flags['identity-file'];
        if (flags.description) updatedData.description = flags.description;
        if (flags['clear-identity']) updatedData.identity_file = undefined;
        if (flags['clear-description']) updatedData.description = undefined;

        if (Object.keys(updatedData).length === 0) {
          OCLIFFormatter.error('No changes specified. Use field flags to specify what to update.');
          this.exit(1);
        }
      } else {
        // Interactive mode: prompt for each field
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'hostname',
            message: 'Hostname (IP or hostname):',
            default: currentHost.hostname,
          },
          {
            type: 'input',
            name: 'user',
            message: 'SSH username:',
            default: currentHost.user,
          },
          {
            type: 'input',
            name: 'port',
            message: 'SSH port:',
            default: currentHost.port.toString(),
            validate: (input: string) => {
              const port = Number.parseInt(input, 10);
              if (Number.isNaN(port) || port < 1 || port > 65535) {
                return 'Please enter a valid port number (1-65535)';
              }
              return true;
            },
          },
          {
            type: 'input',
            name: 'identity_file',
            message: 'SSH identity file (optional):',
            default: currentHost.identity_file || '',
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
            default: currentHost.description || '',
          },
        ]);

        updatedData = {
          hostname: answers.hostname,
          user: answers.user,
          port: Number.parseInt(answers.port, 10),
          identity_file: answers.identity_file || undefined,
          description: answers.description || undefined,
        };
      }

      // Clean up empty values
      if (!updatedData.identity_file) updatedData.identity_file = undefined;
      if (!updatedData.description) updatedData.description = undefined;

      // Check if anything actually changed
      const hasChanges = Object.keys(updatedData).some(key => {
        return updatedData[key] !== currentHost[key];
      });

      if (!hasChanges) {
        OCLIFFormatter.info('No changes detected.');
        return;
      }

      // Create updated host data
      const newHostData = {
        ...currentHost,
        ...updatedData,
        // Preserve metadata
        name: currentHost.name,
        created_at: currentHost.created_at,
        source: currentHost.source,
        connection_success_at: currentHost.connection_success_at,
      };

      // Remove and re-add the host (this is the safest way to update)
      await hostManager.removeHost(hostName);
      const updatedHost = await hostManager.addHost(newHostData, hostName);

      OCLIFFormatter.success(`Host "${hostName}" updated successfully!`);

      // Display updated configuration
      const updatedInfo = [
        { label: 'Hostname', value: updatedHost.hostname },
        { label: 'User', value: updatedHost.user },
        { label: 'Port', value: updatedHost.port.toString() },
      ];

      if (updatedHost.identity_file) {
        updatedInfo.push({ label: 'SSH Key', value: updatedHost.identity_file });
      }
      if (updatedHost.description) {
        updatedInfo.push({ label: 'Description', value: updatedHost.description });
      }

      OCLIFFormatter.table(updatedInfo);

      // Test connection if requested
      if (flags.test) {
        console.log();
        OCLIFFormatter.info('Testing connection...');

        try {
          const result = await testConnection({
            name: updatedHost.name,
            hostname: updatedHost.hostname,
            port: updatedHost.port,
            user: updatedHost.user,
            identity_file: updatedHost.identity_file,
          });

          if (result.success) {
            OCLIFFormatter.success('Connection test successful!');
            await hostManager.updateUsage(hostName);
          } else {
            OCLIFFormatter.error(`Connection test failed: ${result.message}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          OCLIFFormatter.error(`Connection test failed: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to edit host', errorMessage);
      this.exit(1);
    }
  }
}
