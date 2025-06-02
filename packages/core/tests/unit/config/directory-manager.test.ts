/**
 * Tests for DirectoryManager
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

// Create a test version of DirectoryManager that uses a custom directory
class TestDirectoryManager {
  private _globalDir: string;

  constructor(testDir: string) {
    this._globalDir = path.join(testDir, '.aship');
  }
  
  get globalDir(): string {
    return this._globalDir;
  }
  
  set globalDir(dir: string) {
    this._globalDir = dir;
  }

  // Root directory files

  get hostsFile(): string {
    return path.join(this.globalDir, 'hosts.json');
  }

  // State directory files
  get stateDir(): string {
    return path.join(this.globalDir, 'state');
  }

  get recentConnectionFile(): string {
    return path.join(this.stateDir, 'recent-connection.json');
  }

  get hostUsageFile(): string {
    return path.join(this.stateDir, 'host-usage.json');
  }

  // Logs directory
  get logsDir(): string {
    return path.join(this.globalDir, 'logs');
  }

  get mainLogFile(): string {
    return path.join(this.logsDir, 'aship.log');
  }

  get ansibleRunsDir(): string {
    return path.join(this.logsDir, 'ansible');
  }

  // Temp directory
  get tempDir(): string {
    return path.join(this.globalDir, 'temp');
  }
  
  get cacheDir(): string {
    return path.join(this.globalDir, 'cache');
  }
  
  get configDir(): string {
    return path.join(this.globalDir, 'config');
  }
  
  get ansibleConfigFile(): string {
    return path.join(this.cacheDir, 'ansible.manifest.json');
  }
  
  get ansibleParamsFile(): string {
    return this.ansibleConfigFile;
  }

  get inventoriesDir(): string {
    return path.join(this.tempDir, 'inventories');
  }

  get sessionDir(): string {
    return path.join(this.tempDir, 'session');
  }

  async initialize(): Promise<void> {
    const dirs = [
      this.globalDir,
      this.logsDir,
      this.ansibleRunsDir,
      this.tempDir,
      this.inventoriesDir,
      this.sessionDir,
      this.cacheDir,
      this.configDir,
      this.stateDir,
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async cleanTemp(): Promise<void> {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
      await fs.mkdir(this.tempDir, { recursive: true });
      await fs.mkdir(this.inventoriesDir, { recursive: true });
      await fs.mkdir(this.sessionDir, { recursive: true });
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  async cleanLogs(daysOld: number = 30): Promise<void> {
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
    } catch (error) {
      // Ignore errors during cleanup
    }
  }
  
  async createDefaultRcFile(location?: string, force: boolean = false): Promise<string> {
    const appName = path.basename(this._globalDir).startsWith('.') ? 
      path.basename(this._globalDir).substring(1) : 
      path.basename(this._globalDir);
      
    const rcFileName = `.${appName}rc`;
    const filePath = location ? path.join(location, rcFileName) : path.join(os.homedir(), rcFileName);
    
    // Check if file already exists and we're not forcing overwrite
    if (!force && await this.fileExists(filePath)) {
      return filePath;
    }
    
    // Default content in JSON format
    const defaultContent = {
      'aship-dir': this._globalDir,
      'cache-ttl': 3600,
      'log-level': 'info'
    };
    
    try {
      await fs.writeFile(filePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
      return filePath;
    } catch (error) {
      console.warn(`Failed to create default ${rcFileName} file: ${error}`);
      return '';
    }
  }
  
  async createDefaultAshiprc(location?: string, force: boolean = false): Promise<string> {
    return this.createDefaultRcFile(location, force);
  }
}

describe('DirectoryManager', () => {
  let directoryManager: TestDirectoryManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aship-test-'));
    directoryManager = new TestDirectoryManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('constructor', () => {
    it('should create DirectoryManager instance', () => {
      expect(directoryManager).toBeInstanceOf(TestDirectoryManager);
    });
  });

  describe('path getters', () => {

    it('should return correct hosts file path', () => {
      expect(directoryManager.hostsFile).toBe(path.join(tempDir, '.aship', 'hosts.json'));
    });
    
    it('should return correct state directory path', () => {
      expect(directoryManager.stateDir).toBe(path.join(tempDir, '.aship', 'state'));
    });
    
    it('should return correct recent connection file path', () => {
      expect(directoryManager.recentConnectionFile).toBe(path.join(tempDir, '.aship', 'state', 'recent-connection.json'));
    });
    
    it('should return correct host usage file path', () => {
      expect(directoryManager.hostUsageFile).toBe(path.join(tempDir, '.aship', 'state', 'host-usage.json'));
    });

    it('should return correct logs directory path', () => {
      expect(directoryManager.logsDir).toBe(path.join(tempDir, '.aship', 'logs'));
    });

    it('should return correct temp directory path', () => {
      expect(directoryManager.tempDir).toBe(path.join(tempDir, '.aship', 'temp'));
    });
  });

  describe('initialize', () => {
    it('should create all required directories', async () => {
      await directoryManager.initialize();

      // Check that all directories exist
      const dirs = [
        path.join(tempDir, '.aship'),
        directoryManager.logsDir,
        directoryManager.ansibleRunsDir,
        directoryManager.tempDir,
        directoryManager.inventoriesDir,
        directoryManager.sessionDir,
        directoryManager.cacheDir,
        directoryManager.configDir,
        directoryManager.stateDir,
      ];

      for (const dir of dirs) {
        const stats = await fs.stat(dir);
        expect(stats.isDirectory()).toBe(true);
      }
    });

    it('should not fail if directories already exist', async () => {
      // Initialize once
      await directoryManager.initialize();
      
      // Initialize again - should not throw
      await expect(directoryManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('fileExists', () => {
    it('should return false for non-existent file', async () => {
      const exists = await directoryManager.fileExists('/non/existent/file');
      expect(exists).toBe(false);
    });

    it('should return true for existing file', async () => {
      await directoryManager.initialize();
      
      // Create a test file
      const testFile = path.join(tempDir, '.aship', 'test.txt');
      await fs.writeFile(testFile, 'test content');
      
      const exists = await directoryManager.fileExists(testFile);
      expect(exists).toBe(true);
    });
  });

  describe('cleanTemp', () => {
    it('should clean and recreate temp directories', async () => {
      await directoryManager.initialize();
      
      // Create a test file in temp directory
      const testFile = path.join(directoryManager.tempDir, 'test.txt');
      await fs.writeFile(testFile, 'test content');
      
      // Verify file exists
      expect(await directoryManager.fileExists(testFile)).toBe(true);
      
      // Clean temp
      await directoryManager.cleanTemp();
      
      // Verify file is gone but directories still exist
      expect(await directoryManager.fileExists(testFile)).toBe(false);
      
      const tempStats = await fs.stat(directoryManager.tempDir);
      expect(tempStats.isDirectory()).toBe(true);
      
      const inventoriesStats = await fs.stat(directoryManager.inventoriesDir);
      expect(inventoriesStats.isDirectory()).toBe(true);
      
      const sessionStats = await fs.stat(directoryManager.sessionDir);
      expect(sessionStats.isDirectory()).toBe(true);
    });
  });

  describe('cleanLogs', () => {
    it('should remove old log files', async () => {
      await directoryManager.initialize();
      
      // Create test log files with different ages
      const oldFile = path.join(directoryManager.ansibleRunsDir, 'old.log');
      const newFile = path.join(directoryManager.ansibleRunsDir, 'new.log');
      
      await fs.writeFile(oldFile, 'old log');
      await fs.writeFile(newFile, 'new log');
      
      // Set old file's modification time to 31 days ago
      const oldTime = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
      await fs.utimes(oldFile, oldTime, oldTime);
      
      // Clean logs older than 30 days
      await directoryManager.cleanLogs(30);
      
      // Old file should be gone, new file should remain
      expect(await directoryManager.fileExists(oldFile)).toBe(false);
      expect(await directoryManager.fileExists(newFile)).toBe(true);
    });

    it('should not fail if logs directory does not exist', async () => {
      // Don't initialize, so logs directory doesn't exist
      await expect(directoryManager.cleanLogs(30)).resolves.not.toThrow();
    });
  });
  
  describe('createDefaultRcFile', () => {
    it('should create default .ashiprc file in specified location', async () => {
      // Create a custom location for the .ashiprc file
      const customLocation = path.join(tempDir, 'custom');
      await fs.mkdir(customLocation, { recursive: true });
      
      // Create the RC file
      const filePath = await directoryManager.createDefaultRcFile(customLocation);
      
      // Verify file was created
      expect(filePath).toBe(path.join(customLocation, '.ashiprc'));
      expect(await directoryManager.fileExists(filePath)).toBe(true);
      
      // Read and verify content
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config).toHaveProperty('aship-dir', directoryManager.globalDir);
      expect(config).toHaveProperty('cache-ttl', 3600);
      expect(config).toHaveProperty('log-level', 'info');
    });
    
    it('should not overwrite existing .ashiprc file without force option', async () => {
      // Create a custom location
      const customLocation = path.join(tempDir, 'custom2');
      await fs.mkdir(customLocation, { recursive: true });
      
      // Create a pre-existing .ashiprc file with custom content
      const filePath = path.join(customLocation, '.ashiprc');
      const customContent = JSON.stringify({
        'aship-dir': '/custom/path',
        'custom-setting': 'test-value'
      });
      await fs.writeFile(filePath, customContent, 'utf-8');
      
      // Call createDefaultRcFile
      const resultPath = await directoryManager.createDefaultRcFile(customLocation);
      
      // Verify file was not overwritten
      expect(resultPath).toBe(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      expect(config).toHaveProperty('aship-dir', '/custom/path');
      expect(config).toHaveProperty('custom-setting', 'test-value');
      expect(config).not.toHaveProperty('cache-ttl');
    });
    
    it('should overwrite existing .ashiprc file when force option is true', async () => {
      // Create a custom location
      const customLocation = path.join(tempDir, 'custom3');
      await fs.mkdir(customLocation, { recursive: true });
      
      // Create a pre-existing .ashiprc file with custom content
      const filePath = path.join(customLocation, '.ashiprc');
      const customContent = JSON.stringify({
        'aship-dir': '/custom/path',
        'custom-setting': 'test-value'
      });
      await fs.writeFile(filePath, customContent, 'utf-8');
      
      // Call createDefaultRcFile with force=true
      const resultPath = await directoryManager.createDefaultRcFile(customLocation, true);
      
      // Verify file was overwritten
      expect(resultPath).toBe(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      // Should have default values, not the custom ones
      expect(config).toHaveProperty('aship-dir', directoryManager.globalDir);
      expect(config).toHaveProperty('cache-ttl', 3600);
      expect(config).toHaveProperty('log-level', 'info');
      expect(config).not.toHaveProperty('custom-setting');
    });
  });
});
