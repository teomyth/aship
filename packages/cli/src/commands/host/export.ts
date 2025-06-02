import * as fs from 'node:fs/promises';
import { DirectoryManager, HostManager } from '@aship/core';
import { Command, Flags } from '@oclif/core';
import { OCLIFFormatter } from '../../utils/oclif-formatter.js';

export default class HostExport extends Command {
  static override description = 'Export hosts to various formats';

  static override aliases = ['host:save', 'host:dump', 'host:backup'];

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --format json --output hosts.json',
    '<%= config.bin %> <%= command.id %> --format yaml --output hosts.yml',
    '<%= config.bin %> <%= command.id %> --format ssh-config --output ssh_config',
    '<%= config.bin %> <%= command.id %> --format ansible --output inventory.yml',
    '<%= config.bin %> <%= command.id %> --filter "web-*" --format json',
    '<%= config.bin %> host save -f json -o hosts.json',
    '<%= config.bin %> host backup --format ansible',
  ];

  static override flags = {
    format: Flags.string({
      char: 'f',
      description: 'Export format',
      default: 'json',
      options: ['json', 'yaml', 'ssh-config', 'ansible'],
    }),
    output: Flags.string({
      char: 'o',
      description: 'Output file path (default: stdout)',
    }),
    filter: Flags.string({
      description: 'Filter hosts by pattern (supports wildcards)',
    }),
    source: Flags.string({
      char: 's',
      description: 'Filter by source type',
      options: ['manual', 'ssh_config', 'imported'],
    }),
    'include-usage': Flags.boolean({
      description: 'Include usage statistics in export (JSON/YAML only)',
      default: false,
    }),
    pretty: Flags.boolean({
      char: 'p',
      description: 'Pretty print output (JSON only)',
      default: true,
    }),
    group: Flags.string({
      char: 'g',
      description: 'Group name for Ansible inventory format',
      default: 'aship_hosts',
    }),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(HostExport);

    try {
      const directoryManager = new DirectoryManager();
      const hostManager = new HostManager(directoryManager);

      // Get hosts
      let hosts = await hostManager.getHosts();

      if (hosts.length === 0) {
        OCLIFFormatter.info('No hosts configured. Use "aship host add" to add a host.');
        return;
      }

      // Apply filters
      if (flags.source) {
        hosts = hosts.filter(host => host.source === flags.source);
      }

      if (flags.filter) {
        const pattern = flags.filter.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`, 'i');
        hosts = hosts.filter(host => regex.test(host.name));
      }

      if (hosts.length === 0) {
        OCLIFFormatter.info('No hosts match the specified filters.');
        return;
      }

      // Get usage data if requested
      let usageData: any = null;
      if (flags['include-usage']) {
        usageData = await hostManager.getUsageHistory();
      }

      // Generate export content
      let content: string;
      let _defaultExtension: string;

      switch (flags.format) {
        case 'json':
          content = this.exportToJSON(hosts, usageData, flags.pretty);
          _defaultExtension = '.json';
          break;
        case 'yaml':
          content = this.exportToYAML(hosts, usageData);
          _defaultExtension = '.yml';
          break;
        case 'ssh-config':
          content = this.exportToSSHConfig(hosts);
          _defaultExtension = '';
          break;
        case 'ansible':
          content = this.exportToAnsible(hosts, flags.group);
          _defaultExtension = '.yml';
          break;
        default:
          OCLIFFormatter.error(`Unsupported format: ${flags.format}`);
          this.exit(1);
      }

      // Output to file or stdout
      if (flags.output) {
        await fs.writeFile(flags.output, content, 'utf-8');
        OCLIFFormatter.success(`Exported ${hosts.length} host(s) to ${flags.output}`);
      } else {
        // Output to stdout
        console.log(content);
      }

      // Show summary
      if (flags.output) {
        const stats = [
          { label: 'Hosts exported', value: hosts.length.toString() },
          { label: 'Format', value: flags.format },
          { label: 'Output file', value: flags.output },
        ];

        if (flags.filter) {
          stats.push({ label: 'Filter', value: flags.filter });
        }
        if (flags.source) {
          stats.push({ label: 'Source filter', value: flags.source });
        }

        console.log();
        OCLIFFormatter.table(stats);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      OCLIFFormatter.error('Failed to export hosts', errorMessage);
      this.exit(1);
    }
  }

  private exportToJSON(hosts: any[], usageData: any, pretty: boolean): string {
    const data = {
      hosts: hosts.map(host => ({
        name: host.name,
        hostname: host.hostname,
        user: host.user,
        port: host.port,
        ...(host.identity_file && { identity_file: host.identity_file }),
        ...(host.description && { description: host.description }),
        source: host.source,
        created_at: host.created_at,
        ...(host.connection_success_at && { connection_success_at: host.connection_success_at }),
        ...(usageData?.[host.name] && { usage: usageData[host.name] }),
      })),
      exported_at: new Date().toISOString(),
      total_hosts: hosts.length,
    };

    return JSON.stringify(data, null, pretty ? 2 : 0);
  }

  private exportToYAML(hosts: any[], usageData: any): string {
    const yaml = require('js-yaml');

    const data = {
      hosts: hosts.reduce((acc, host) => {
        acc[host.name] = {
          hostname: host.hostname,
          user: host.user,
          port: host.port,
          ...(host.identity_file && { identity_file: host.identity_file }),
          ...(host.description && { description: host.description }),
          source: host.source,
          created_at: host.created_at,
          ...(host.connection_success_at && { connection_success_at: host.connection_success_at }),
          ...(usageData?.[host.name] && { usage: usageData[host.name] }),
        };
        return acc;
      }, {} as any),
      exported_at: new Date().toISOString(),
      total_hosts: hosts.length,
    };

    return yaml.dump(data, { indent: 2 });
  }

  private exportToSSHConfig(hosts: any[]): string {
    const lines: string[] = [];

    lines.push('# Exported from Aship');
    lines.push(`# Generated on ${new Date().toISOString()}`);
    lines.push('');

    for (const host of hosts) {
      lines.push(`Host ${host.name}`);
      lines.push(`    HostName ${host.hostname}`);
      lines.push(`    User ${host.user}`);

      if (host.port !== 22) {
        lines.push(`    Port ${host.port}`);
      }

      if (host.identity_file) {
        lines.push(`    IdentityFile ${host.identity_file}`);
      }

      if (host.description) {
        lines.push(`    # ${host.description}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  private exportToAnsible(hosts: any[], groupName: string): string {
    const yaml = require('js-yaml');

    const inventory: any = {
      [groupName]: {
        hosts: {},
      },
    };

    for (const host of hosts) {
      inventory[groupName].hosts[host.name] = {
        ansible_host: host.hostname,
        ansible_user: host.user,
        ...(host.port !== 22 && { ansible_port: host.port }),
        ...(host.identity_file && { ansible_ssh_private_key_file: host.identity_file }),
      };
    }

    // Add metadata as comments
    const header = [
      '# Ansible inventory exported from Aship',
      `# Generated on ${new Date().toISOString()}`,
      `# Total hosts: ${hosts.length}`,
      '',
    ].join('\n');

    return header + yaml.dump(inventory, { indent: 2 });
  }
}
