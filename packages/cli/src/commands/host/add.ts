import { DirectoryManager, HostManager, logger, testConnection } from '@aship/core';
import { Command, Flags } from '@oclif/core';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostAdd extends Command {
  static override description = 'Add a new host to Aship';

  static override aliases = ['host:create', 'host:new'];

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --name web-server --hostname 192.168.1.100 --user ubuntu',
    '<%= config.bin %> <%= command.id %> --hostname example.com --port 2222 --test',
    '<%= config.bin %> <%= command.id %> --non-interactive --name db-server --hostname db.example.com --user admin',
    '<%= config.bin %> host create --hostname example.com',
    '<%= config.bin %> host new -n web-server -h 192.168.1.100 -u ubuntu',
  ];

  static override flags = {
    name: Flags.string({
      char: 'n',
      description: 'Host name',
    }),
    hostname: Flags.string({
      char: 'h',
      description: 'Host hostname (IP or hostname)',
    }),
    port: Flags.string({
      char: 'p',
      description: 'SSH port',
      default: '22',
    }),
    user: Flags.string({
      char: 'u',
      description: 'SSH username',
    }),
    'identity-file': Flags.string({
      char: 'i',
      description: 'Path to SSH identity file (optional)',
    }),
    description: Flags.string({
      char: 'd',
      description: 'Host description',
    }),
    'non-interactive': Flags.boolean({
      description: 'Run in non-interactive mode (requires all necessary options)',
      default: false,
    }),
    test: Flags.boolean({
      char: 't',
      description: 'Test connection after adding',
      default: false,
    }),
    force: Flags.boolean({
      char: 'f',
      description: 'Overwrite existing host with same name',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(HostAdd);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      let hostData: any = {};

      if (flags['non-interactive']) {
        // Non-interactive mode - use provided flags
        if (!flags.hostname) {
          logger.error('--hostname is required in non-interactive mode');
          this.exit(1);
        }

        hostData = {
          hostname: flags.hostname,
          port: Number.parseInt(flags.port, 10),
          user: flags.user,
          identity_file: flags['identity-file'],
          description: flags.description,
          source: 'manual' as const,
        };
      } else {
        // Interactive mode - prompt for missing information
        const questions: any[] = [];

        if (!flags.hostname) {
          questions.push({
            type: 'input',
            name: 'hostname',
            message: 'Host hostname (IP address or domain name):',
            validate: (input: string) => (input.trim() ? true : 'Hostname is required'),
          });
        }

        if (!flags.user) {
          questions.push({
            type: 'input',
            name: 'user',
            message: 'SSH username:',
            validate: (input: string) => (input.trim() ? true : 'Username is required'),
          });
        }

        if (!flags.port || flags.port === '22') {
          questions.push({
            type: 'input',
            name: 'port',
            message: 'SSH port:',
            default: '22',
            validate: (input: string) => {
              const port = Number.parseInt(input, 10);
              return port > 0 && port <= 65535 ? true : 'Port must be between 1 and 65535';
            },
          });
        }

        questions.push({
          type: 'input',
          name: 'identity_file',
          message: 'SSH identity file path (optional):',
        });

        questions.push({
          type: 'input',
          name: 'description',
          message: 'Host description (optional):',
        });

        const answers = await inquirer.prompt(questions);

        hostData = {
          hostname: flags.hostname || answers.hostname,
          port: Number.parseInt(flags.port !== '22' ? flags.port : answers.port || '22', 10),
          user: flags.user || answers.user,
          identity_file: flags['identity-file'] || answers.identity_file || undefined,
          description: flags.description || answers.description || undefined,
          source: 'manual' as const,
        };
      }

      // Clean up empty values
      if (!hostData.identity_file) hostData.identity_file = undefined;
      if (!hostData.description) hostData.description = undefined;

      // Determine host name
      const hostName = flags.name || hostData.hostname;

      // Check if host already exists
      const existingHost = await hostManager.getHost(hostName);
      if (existingHost && !flags.force) {
        logger.error(`Host "${hostName}" already exists. Use --force to overwrite.`);
        this.exit(1);
      }

      // Test connection if requested
      if (flags.test) {
        logger.info('Testing connection...');
        const connectionResult = await testConnection({
          name: hostName,
          hostname: hostData.hostname,
          port: hostData.port,
          user: hostData.user,
          identity_file: hostData.identity_file,
        });

        if (connectionResult.success) {
          OCLIFFormatter.success('Connection test successful!');
        } else {
          OCLIFFormatter.error(`Connection test failed: ${connectionResult.message}`);
          if (flags['non-interactive']) {
            this.exit(1);
          } else {
            const { proceed } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'proceed',
                message: 'Connection test failed. Do you want to add the host anyway?',
                default: false,
              },
            ]);
            if (!proceed) {
              OCLIFFormatter.info('Host not added');
              return;
            }
          }
        }
      }

      // Add the host
      if (existingHost && flags.force) {
        await hostManager.removeHost(hostName);
        OCLIFFormatter.info(`Removed existing host "${hostName}"`);
      }

      const newHost = await hostManager.addHost(hostData, hostName);
      OCLIFFormatter.success(`Host "${newHost.name}" added successfully!`);

      // Display host information using OCLIF formatter
      const hostDetails = [
        { label: 'Name', value: newHost.name },
        {
          label: 'Address',
          value: `${newHost.user ? `${newHost.user}@` : ''}${newHost.hostname}${newHost.port !== 22 ? `:${newHost.port}` : ''}`,
        },
      ];

      if (newHost.identity_file) {
        hostDetails.push({ label: 'Key', value: newHost.identity_file });
      }
      if (newHost.description) {
        hostDetails.push({ label: 'Description', value: newHost.description });
      }

      // Add source to details
      hostDetails.push({ label: 'Source', value: newHost.source });

      OCLIFFormatter.summary('Host Details', hostDetails);
    } catch (error) {
      OCLIFFormatter.error(
        'Failed to add host',
        error instanceof Error ? error.message : String(error)
      );
      this.exit(1);
    }
  }
}
