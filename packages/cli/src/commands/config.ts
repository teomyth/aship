/**
 * Config command for managing Aship configuration
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DirectoryManager } from '@aship/core';
import { Args, Command, Flags } from '@oclif/core';

/**
 * Config command for managing Aship configuration
 */
export default class ConfigCommand extends Command {
  static description = 'Manage Aship configuration';

  static examples = [
    '$ aship config get aship_dir',
    '$ aship config set aship_dir ~/custom-aship',
    '$ aship config list',
    '$ aship config migrate --from ~/.aship --to ~/custom-aship',
    '$ aship config init -l ~/custom-aship',
    '$ aship config init -f',
  ];

  static override flags = {
    from: Flags.string({
      description: 'Source directory to migrate from',
    }),
    to: Flags.string({
      description: 'Target directory to migrate to',
    }),
    'dry-run': Flags.boolean({
      description: 'Show what would be migrated without actually doing it',
      default: false,
    }),
    location: Flags.string({
      description: 'Location to create the config file (default: user home directory)',
      char: 'l',
    }),
    force: Flags.boolean({
      description: 'Force overwrite if config file already exists',
      char: 'f',
      default: false,
    }),
  };

  static override args = {
    command: Args.string({
      name: 'command',
      required: true,
      description: 'Command to run: get, set, list, migrate, init',
      options: ['get', 'set', 'list', 'migrate', 'init'],
    }),
    key: Args.string({
      name: 'key',
      description: 'Configuration key (for get/set commands)',
      options: ['aship_dir'],
    }),
    value: Args.string({
      name: 'value',
      description: 'Configuration value (for set command)',
    }),
  };

  async run() {
    const { args } = await this.parse(ConfigCommand);
    const command = args.command as string;
    switch (command) {
      case 'get':
        await this.handleGet(args.key as string);
        break;
      case 'set':
        if (!args.key || !args.value) {
          this.error('Both key and value are required for set command');
          return;
        }
        await this.handleSet(args.key as string, args.value as string);
        break;
      case 'list':
        await this.handleList();
        break;
      case 'migrate':
        await this.handleMigrate();
        break;
      case 'init':
        await this.handleInit();
        break;
      default:
        this.error(`Unknown command: ${command}`);
    }
  }

  /**
   * Handle get command
   * @param key Configuration key
   */
  private async handleGet(key?: string) {
    const directoryManager = new DirectoryManager();

    if (!key || key === 'aship_dir') {
      this.log(`aship_dir=${directoryManager.getGlobalDir()}`);
    } else {
      this.error(`Unknown configuration key: ${key}`);
    }
  }

  /**
   * Handle set command
   * @param key Configuration key
   * @param value Configuration value
   */
  private async handleSet(key: string, value: string) {
    if (key === 'aship_dir') {
      // Update user configuration file
      const userConfigPath = path.join(os.homedir(), '.ashiprc');
      let content = '';

      try {
        if (fs.existsSync(userConfigPath)) {
          content = fs.readFileSync(userConfigPath, 'utf8');
        }
      } catch (_error) {
        // If file doesn't exist or can't be read, use empty content
      }

      // Check content format and update accordingly
      if (content.trim().startsWith('{')) {
        // JSON format
        let config = {};
        try {
          config = JSON.parse(content);
        } catch {
          config = {};
        }
        config = { ...config, globalDir: value };
        fs.writeFileSync(userConfigPath, JSON.stringify(config, null, 2));
      } else {
        // INI format (similar to .npmrc)
        const lines = content.split('\n').filter(line => !line.match(/^\s*aship_dir\s*=/));
        lines.push(`aship_dir=${value}`);
        fs.writeFileSync(userConfigPath, lines.join('\n'));
      }

      this.log(`Global directory set to: ${value}`);
    } else {
      this.error(`Unknown configuration key: ${key}`);
    }
  }

  /**
   * Handle list command
   */
  private async handleList() {
    const directoryManager = new DirectoryManager();

    const config = {
      aship_dir: directoryManager.getGlobalDir(),
      // Other configuration items...
    };

    Object.entries(config).forEach(([key, value]) => {
      this.log(`${key}=${value}`);
    });
  }

  /**
   * Handle init command - create default .ashiprc file
   */
  async handleInit() {
    // Parse flags
    const { flags } = await this.parse(ConfigCommand);
    const location = flags.location;
    const force = flags.force;

    const directoryManager = new DirectoryManager();
    const appName = path.basename(directoryManager.globalDir).startsWith('.')
      ? path.basename(directoryManager.globalDir).substring(1)
      : path.basename(directoryManager.globalDir);
    const rcFileName = `.${appName}rc`;

    try {
      // Check if file exists first
      const targetPath = location
        ? path.join(location, rcFileName)
        : path.join(os.homedir(), rcFileName);
      const fileExists = await directoryManager.fileExists(targetPath);

      if (fileExists && !force) {
        this.log(`Config file already exists at: ${targetPath}`);
        this.log('Use --force or -f flag to overwrite the existing file.');
        return;
      }

      // Create or overwrite the file
      const filePath = await directoryManager.createDefaultRcFile(location, force);
      if (filePath) {
        if (fileExists && force) {
          this.log(`Overwritten existing ${rcFileName} file at: ${filePath}`);
        } else {
          this.log(`Created default ${rcFileName} file at: ${filePath}`);
        }
        this.log('You can modify this file manually or use the config commands.');
      } else {
        this.error(`Failed to create default ${rcFileName} file`);
      }
    } catch (error) {
      this.error(`Error creating default config file: ${error}`);
    }
  }

  /**
   * Handle migrate command
   */
  async handleMigrate() {
    const directoryManager = new DirectoryManager();
    const defaultFromDir = path.join(os.homedir(), '.aship');

    // Get from/to flags
    const { flags } = await this.parse(ConfigCommand);
    const fromDir = flags.from || defaultFromDir;
    const toDir = flags.to || directoryManager.getGlobalDir();
    const dryRun = flags['dry-run'];

    if (fromDir === toDir) {
      this.log('Source and target directories are the same. No migration needed.');
      return;
    }

    this.log(`Migrating configuration from ${fromDir} to ${toDir}...`);

    if (dryRun) {
      this.log('Dry run mode. No changes will be made.');
    }

    // Check if source directory exists
    if (!fs.existsSync(fromDir)) {
      this.error(`Source directory ${fromDir} does not exist.`);
      return;
    }

    // Create target directory
    if (!dryRun && !fs.existsSync(toDir)) {
      fs.mkdirSync(toDir, { recursive: true });
    }

    // Implement migration logic
    const copyFiles = async (src: string, dest: string) => {
      const entries = fs.readdirSync(src, { withFileTypes: true });

      for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
          if (!dryRun) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
          }
          this.log(`Creating directory: ${destPath}`);
          await copyFiles(srcPath, destPath);
        } else {
          this.log(`Copying file: ${srcPath} -> ${destPath}`);
          if (!dryRun) {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      }
    };

    try {
      await copyFiles(fromDir, toDir);
      this.log('Migration completed successfully!');

      if (!dryRun) {
        // Update global directory configuration
        await this.handleSet('aship_dir', toDir);
      }
    } catch (error) {
      this.error(`Migration failed: ${error}`);
    }
  }
}
