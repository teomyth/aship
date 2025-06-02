import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { DirectoryManager, HostManager } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostImport extends Command {
  static override description = 'Import hosts from SSH config or other sources';

  static override aliases = ['host:load', 'host:sync'];

  static override examples = [
    '<%= config.bin %> <%= command.id %> --ssh-config',
    '<%= config.bin %> <%= command.id %> --file hosts.json',
    '<%= config.bin %> <%= command.id %> --ssh-config --filter "web-*"',
    '<%= config.bin %> <%= command.id %> --file hosts.yml --force',
    '<%= config.bin %> host load --ssh-config',
    '<%= config.bin %> host sync -f hosts.json',
  ];

  static override args = {
    source: Args.string({
      description: 'Source to import from (ssh-config|file)',
      required: false,
    }),
  };

  static override flags = {
    'ssh-config': Flags.boolean({
      description: 'Import from SSH config file (~/.ssh/config)',
      default: false,
    }),
    file: Flags.string({
      char: 'f',
      description: 'Import from JSON/YAML file',
    }),
    filter: Flags.string({
      description: 'Filter hosts by pattern (supports wildcards)',
    }),
    force: Flags.boolean({
      description: 'Overwrite existing hosts with same names',
      default: false,
    }),
    'dry-run': Flags.boolean({
      char: 'd',
      description: 'Show what would be imported without actually importing',
      default: false,
    }),
    interactive: Flags.boolean({
      char: 'i',
      description: 'Interactively select which hosts to import',
      default: false,
    }),
  };

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(HostImport);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      // Determine import source
      let importSource = args.source;
      if (flags['ssh-config']) importSource = 'ssh-config';
      if (flags.file) importSource = 'file';

      if (!importSource) {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'source',
            message: 'Select import source:',
            choices: [
              { name: 'SSH Config (~/.ssh/config)', value: 'ssh-config' },
              { name: 'JSON/YAML file', value: 'file' },
            ],
          },
        ]);
        importSource = answer.source;
      }

      let hostsToImport: any[] = [];

      if (importSource === 'ssh-config') {
        hostsToImport = await this.importFromSSHConfig(flags);
      } else if (importSource === 'file') {
        hostsToImport = await this.importFromFile(flags);
      } else {
        OCLIFFormatter.error('Invalid import source. Use --ssh-config or --file.');
        this.exit(1);
      }

      if (hostsToImport.length === 0) {
        OCLIFFormatter.info('No hosts found to import.');
        return;
      }

      // Apply filter if specified
      if (flags.filter) {
        const pattern = flags.filter.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        hostsToImport = hostsToImport.filter(host => regex.test(host.name));

        if (hostsToImport.length === 0) {
          OCLIFFormatter.info(`No hosts match filter "${flags.filter}".`);
          return;
        }
      }

      // Interactive selection
      if (flags.interactive) {
        const choices = hostsToImport.map(host => ({
          name: `${host.name} (${host.user ? `${host.user}@` : ''}${host.hostname}${host.port !== 22 ? `:${host.port}` : ''})`,
          value: host.name,
          checked: true,
        }));

        const answer = await inquirer.prompt([
          {
            type: 'checkbox',
            name: 'selectedHosts',
            message: 'Select hosts to import:',
            choices,
          },
        ]);

        hostsToImport = hostsToImport.filter(host => answer.selectedHosts.includes(host.name));
      }

      if (hostsToImport.length === 0) {
        OCLIFFormatter.info('No hosts selected for import.');
        return;
      }

      // Check for conflicts
      const existingHosts = await hostManager.getHosts();
      const existingNames = new Set(existingHosts.map(h => h.name));
      const conflicts = hostsToImport.filter(host => existingNames.has(host.name));

      if (conflicts.length > 0 && !flags.force) {
        console.log(chalk.yellow('⚠️  The following hosts already exist:'));
        for (const host of conflicts) {
          console.log(`   • ${host.name}`);
        }
        console.log();

        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite existing hosts?',
            default: false,
          },
        ]);

        if (!answer.overwrite) {
          // Filter out conflicts
          hostsToImport = hostsToImport.filter(host => !existingNames.has(host.name));

          if (hostsToImport.length === 0) {
            OCLIFFormatter.info('No new hosts to import.');
            return;
          }
        }
      }

      // Dry run mode
      if (flags['dry-run']) {
        console.log(chalk.cyan.bold('Dry run - would import the following hosts:'));
        console.log();

        for (const host of hostsToImport) {
          const userInfo = host.user ? `${host.user}@` : '';
          const portInfo = host.port !== 22 ? `:${host.port}` : '';
          const status = existingNames.has(host.name)
            ? chalk.yellow('(overwrite)')
            : chalk.green('(new)');

          console.log(`${chalk.cyan('•')} ${host.name} ${status}`);
          console.log(`  ${chalk.gray('Address:')} ${userInfo}${host.hostname}${portInfo}`);
          if (host.description) {
            console.log(`  ${chalk.gray('Description:')} ${host.description}`);
          }
          console.log();
        }

        OCLIFFormatter.info(
          `Would import ${hostsToImport.length} host(s). Use without --dry-run to actually import.`
        );
        return;
      }

      // Perform the import
      let imported = 0;
      let overwritten = 0;

      for (const hostData of hostsToImport) {
        try {
          const isOverwrite = existingNames.has(hostData.name);

          if (isOverwrite) {
            await hostManager.removeHost(hostData.name);
            overwritten++;
          } else {
            imported++;
          }

          await hostManager.addHost(
            {
              hostname: hostData.hostname,
              user: hostData.user,
              port: hostData.port || 22,
              identity_file: hostData.identity_file,
              description: hostData.description,
              source: 'imported',
            },
            hostData.name
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          OCLIFFormatter.error(`Failed to import host "${hostData.name}": ${errorMessage}`);
        }
      }

      // Summary
      const total = imported + overwritten;
      if (total > 0) {
        OCLIFFormatter.success(`Successfully imported ${total} host(s)!`);

        if (imported > 0) {
          OCLIFFormatter.info(`${imported} new host(s) added`);
        }
        if (overwritten > 0) {
          OCLIFFormatter.info(`${overwritten} existing host(s) overwritten`);
        }

        console.log();
        OCLIFFormatter.info('Use "aship host list" to view all hosts.');
      } else {
        OCLIFFormatter.info('No hosts were imported.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to import hosts', errorMessage);
      this.exit(1);
    }
  }

  private async importFromSSHConfig(_flags: any): Promise<any[]> {
    const sshConfigPath = path.join(os.homedir(), '.ssh', 'config');

    try {
      await fs.access(sshConfigPath);
    } catch {
      OCLIFFormatter.error('SSH config file not found at ~/.ssh/config');
      this.exit(1);
    }

    try {
      const content = await fs.readFile(sshConfigPath, 'utf-8');
      return this.parseSSHConfig(content);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error(`Failed to read SSH config: ${errorMessage}`);
      this.exit(1);
    }
  }

  private async importFromFile(flags: any): Promise<any[]> {
    let filePath = flags.file;

    if (!filePath) {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'filePath',
          message: 'Enter path to JSON/YAML file:',
          validate: (input: string) => input.trim().length > 0 || 'File path is required',
        },
      ]);
      filePath = answer.filePath;
    }

    try {
      await fs.access(filePath);
    } catch {
      OCLIFFormatter.error(`File not found: ${filePath}`);
      this.exit(1);
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.json') {
        return this.parseJSONFile(content);
      }
      if (ext === '.yml' || ext === '.yaml') {
        return this.parseYAMLFile(content);
      }
      // Try to detect format
      try {
        return this.parseJSONFile(content);
      } catch {
        return this.parseYAMLFile(content);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error(`Failed to parse file: ${errorMessage}`);
      this.exit(1);
    }
  }

  private parseSSHConfig(content: string): any[] {
    const hosts: any[] = [];
    const lines = content.split('\n');
    let currentHost: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('Host ') && !trimmed.includes('*')) {
        if (currentHost) {
          hosts.push(currentHost);
        }

        const hostName = trimmed.substring(5).trim();
        currentHost = {
          name: hostName,
          hostname: hostName, // Default to host name
          user: process.env.USER || 'root',
          port: 22,
        };
      } else if (currentHost && trimmed.includes(' ')) {
        const [key, ...valueParts] = trimmed.split(' ');
        const value = valueParts.join(' ');

        switch (key.toLowerCase()) {
          case 'hostname':
            currentHost.hostname = value;
            break;
          case 'user':
            currentHost.user = value;
            break;
          case 'port':
            currentHost.port = Number.parseInt(value, 10) || 22;
            break;
          case 'identityfile':
            currentHost.identity_file = value.replace('~', os.homedir());
            break;
        }
      }
    }

    if (currentHost) {
      hosts.push(currentHost);
    }

    return hosts;
  }

  private parseJSONFile(content: string): any[] {
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      return data;
    }
    if (data.hosts && Array.isArray(data.hosts)) {
      return data.hosts;
    }
    throw new Error('Invalid JSON format. Expected array of hosts or object with hosts array.');
  }

  private parseYAMLFile(content: string): any[] {
    const yaml = require('js-yaml');
    const data = yaml.load(content);

    if (Array.isArray(data)) {
      return data;
    }
    if (data.hosts && Array.isArray(data.hosts)) {
      return data.hosts;
    }
    if (data.hosts && typeof data.hosts === 'object') {
      // Convert object format to array
      return Object.entries(data.hosts).map(([name, config]: [string, any]) => ({
        name,
        ...config,
      }));
    }
    throw new Error('Invalid YAML format. Expected array of hosts or object with hosts.');
  }
}
