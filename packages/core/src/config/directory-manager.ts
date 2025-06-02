/**
 * Directory manager for managing Aship global directory structure
 */

import * as fsSync from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  APP_NAME,
  CACHE_DIR_NAME,
  CONFIG_DIR_KEY,
  CONFIG_DIR_NAME,
  CONFIG_DIR_SUBNAME,
  CONFIG_FILE_NAME,
  ENV_GLOBAL_DIR,
  HOSTS_FILE_NAME,
  INVENTORIES_DIR_NAME,
  LOGS_DIR_NAME,
  SESSION_DIR_NAME,
  STATE_DIR_NAME,
  TEMP_DIR_NAME,
} from '../constants.js';

/**
 * Manages the new global directory structure for Aship
 * Replaces the old directory.ts with a class-based approach
 */
export class DirectoryManager {
  private _globalDir: string;

  constructor() {
    this._globalDir = this.resolveGlobalDir();
  }

  /**
   * Resolve global directory path based on configuration sources
   * @returns Resolved global directory path
   */
  private resolveGlobalDir(): string {
    // 1. Check environment variable
    const envVar = ENV_GLOBAL_DIR;
    if (process.env[envVar]) {
      return process.env[envVar];
    }

    // 2. Check .ashiprc files
    const configFile = this.findConfigFile();
    if (configFile) {
      try {
        const content = fsSync.readFileSync(configFile, 'utf8');
        // Support both JSON and INI formats
        if (content.trim().startsWith('{')) {
          // JSON format
          const config = JSON.parse(content);
          // Only check for new underscore format
          if (config[CONFIG_DIR_KEY]) {
            return config[CONFIG_DIR_KEY];
          }
        } else {
          // INI format (similar to .npmrc)
          const lines = content.split('\n');

          // Only match the new underscore format
          const configKeyRegex = new RegExp(`^\\s*${CONFIG_DIR_KEY}\\s*=\\s*(.+)\\s*$`);
          for (const line of lines) {
            const match = line.match(configKeyRegex);
            if (match) {
              return match[1].trim();
            }
          }
        }
      } catch (error) {
        // Configuration reading error, use default value
        console.warn(`Error reading configuration file: ${error}`);
      }
    }

    // 3. Use default location
    return path.join(os.homedir(), CONFIG_DIR_NAME);
  }

  /**
   * Find configuration file based on search order
   * @returns Path to found configuration file or null if not found
   */
  private findConfigFile(): string | null {
    // 1. Project directory config file
    const projectConfig = path.join(process.cwd(), CONFIG_FILE_NAME);
    if (fsSync.existsSync(projectConfig)) {
      return projectConfig;
    }

    // 2. User home directory config file
    const userConfig = path.join(os.homedir(), CONFIG_FILE_NAME);
    if (fsSync.existsSync(userConfig)) {
      return userConfig;
    }

    // 3. User config directory config file
    const userConfigDir = path.join(os.homedir(), '.config', APP_NAME, 'config');
    if (fsSync.existsSync(userConfigDir)) {
      return userConfigDir;
    }

    return null;
  }

  /**
   * Get the global directory path
   * @returns The global directory path
   */
  getGlobalDir(): string {
    return this._globalDir;
  }

  /**
   * Set the global directory path
   * @param dir The global directory path
   */
  setGlobalDir(dir: string): void {
    this._globalDir = dir;
  }

  /**
   * Get the global directory path
   * @deprecated Use getGlobalDir() instead
   */
  get globalDir(): string {
    return this.getGlobalDir();
  }

  /**
   * Set the global directory path
   * This is used when the directory is changed at runtime
   * @deprecated Use setGlobalDir() instead
   */
  set globalDir(dir: string) {
    this.setGlobalDir(dir);
  }

  get hostsFile(): string {
    return path.join(this.globalDir, HOSTS_FILE_NAME);
  }

  // State directory files
  get stateDir(): string {
    return path.join(this.globalDir, STATE_DIR_NAME);
  }

  get recentConnectionFile(): string {
    return path.join(this.stateDir, 'recent-connection.json');
  }

  get hostUsageFile(): string {
    return path.join(this.stateDir, 'host-usage.json');
  }

  // Logs directory
  get logsDir(): string {
    return path.join(this.globalDir, LOGS_DIR_NAME);
  }

  get mainLogFile(): string {
    return path.join(this.logsDir, `${APP_NAME}.log`);
  }

  get ansibleRunsDir(): string {
    return path.join(this.logsDir, 'ansible');
  }

  // Temp directory
  get tempDir(): string {
    return path.join(this.globalDir, TEMP_DIR_NAME);
  }

  get cacheDir(): string {
    return path.join(this.globalDir, CACHE_DIR_NAME);
  }

  get configDir(): string {
    return path.join(this.globalDir, CONFIG_DIR_SUBNAME);
  }

  get inventoriesDir(): string {
    return path.join(this.tempDir, INVENTORIES_DIR_NAME);
  }

  get sessionDir(): string {
    return path.join(this.tempDir, SESSION_DIR_NAME);
  }

  // Ansible configuration file (formerly ansible-params.json)
  get ansibleConfigFile(): string {
    return path.join(this.cacheDir, 'ansible.manifest.json');
  }

  // Compatibility method, maintain backward compatibility
  get ansibleParamsFile(): string {
    return this.ansibleConfigFile;
  }

  /**
   * Create default RC configuration file
   * @param location Location to create the file, default is user home directory
   * @param force If true, overwrite existing file; if false, don't overwrite if file exists
   * @returns Path to the created/existing file, or empty string if creation failed
   */
  // Get application name from constants
  // Using a centrally defined constant ensures consistency across the application
  private getAppName(): string {
    return APP_NAME;
  }

  async createDefaultRcFile(location?: string, force = false): Promise<string> {
    const appName = this.getAppName();
    const rcFileName = `.${appName}rc`;
    const filePath = location
      ? path.join(location, rcFileName)
      : path.join(os.homedir(), rcFileName);

    // Check if file already exists and we're not forcing overwrite
    if (!force && (await this.fileExists(filePath))) {
      return filePath;
    }

    // Load RC template from core package root directory
    const currentFilePath = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFilePath);
    // Go up from dist/config to the package root where templates directory is located
    const packageRoot = path.resolve(currentDir, '../../');
    const templatePath = path.join(packageRoot, 'templates', 'rc.template');
    let templateContent = '';
    let configContent = '';

    try {
      // Try to read the template file
      templateContent = await fs.readFile(templatePath, 'utf-8');

      // Replace placeholders in template
      configContent = templateContent
        .replace(/~\/\.app/g, this._globalDir)
        .replace(/config /g, `${appName} config `);
    } catch (_error) {
      // If template file doesn't exist or can't be read, create a default config
      // Using INI format with underscore format for keys
      configContent = `# ${appName} configuration file

# Global directory for ${appName} data (default: ~/.${appName})
${CONFIG_DIR_KEY} = ${this._globalDir}

# Log level (options: debug, info, warn, error)
log_level = info
`;
    }

    try {
      await fs.writeFile(filePath, configContent, 'utf-8');
      return filePath;
    } catch (error) {
      console.warn(`Failed to create default RC file: ${error}`);
      return '';
    }
  }

  /**
   * @deprecated Use createDefaultRcFile instead
   */
  async createDefaultAshiprc(location?: string, force = false): Promise<string> {
    return this.createDefaultRcFile(location, force);
  }

  /**
   * Initialize the directory structure
   */
  async initialize(): Promise<void> {
    try {
      // Create all necessary directories
      const dirs = [
        this.globalDir,
        this.logsDir,
        this.ansibleRunsDir,
        this.tempDir,
        this.inventoriesDir,
        this.sessionDir,
        this.cacheDir,
        this.configDir,
        this.stateDir, // Add state directory
      ];

      for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
      }

      // Ensure basic configuration files exist (create empty files if they don't)
      const emptyConfigFiles = [
        { path: this.hostsFile, content: '{"hosts":[]}' },
        {
          path: this.ansibleConfigFile,
          content: `{"version":"unknown","lastUpdated":"${new Date().toISOString()}","parameters":[]}`,
        },
      ];

      // Check if old path files exist, migrate them if they do
      const oldAnsibleParamsPath = path.join(this.cacheDir, 'ansible-params.json');
      const oldHostsPath = path.join(this.globalDir, 'hosts.yml');

      // Migrate old ansible parameter files
      if (
        (await this.fileExists(oldAnsibleParamsPath)) &&
        !(await this.fileExists(this.ansibleConfigFile))
      ) {
        try {
          const oldContent = await fs.readFile(oldAnsibleParamsPath, 'utf-8');
          await fs.writeFile(this.ansibleConfigFile, oldContent, 'utf-8');
        } catch (migrationError) {
          console.warn(`Failed to migrate ansible config file: ${migrationError}`);
        }
      }

      // Migrate old host files
      if ((await this.fileExists(oldHostsPath)) && !(await this.fileExists(this.hostsFile))) {
        try {
          const _oldContent = await fs.readFile(oldHostsPath, 'utf-8');
          // Try to convert YAML to JSON (a YAML parsing library is needed in practice)
          // Since we don't directly import a YAML library, just create a simple JSON object here
          await fs.writeFile(this.hostsFile, '{"hosts":[],"migratedFromYaml":true}', 'utf-8');
        } catch (migrationError) {
          console.warn(`Failed to migrate hosts file: ${migrationError}`);
        }
      }

      for (const file of emptyConfigFiles) {
        if (!(await this.fileExists(file.path))) {
          try {
            await fs.writeFile(file.path, file.content, 'utf-8');
          } catch (error) {
            console.warn(`Failed to create empty config file ${file.path}:`, error);
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to initialize directory structure: ${error instanceof Error ? error.message : String(error)}`
      );
      // Continue execution as much as possible, even if errors occur
    }
  }

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean temporary files
   */
  async cleanTemp(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.inventoriesDir, { recursive: true });
      await fs.mkdir(this.sessionDir, { recursive: true });
    } catch (_error) {
      // Ignore errors during cleanup
    }
  }

  /**
   * Clean old log files
   */
  async cleanLogs(daysOld = 30): Promise<void> {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

    try {
      const files = await fs.readdir(this.ansibleRunsDir);
      for (const file of files) {
        const filePath = path.join(this.ansibleRunsDir, file);
        const stats = await fs.stat(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
        }
      }
    } catch (_error) {
      // Ignore errors during cleanup
    }
  }
}
