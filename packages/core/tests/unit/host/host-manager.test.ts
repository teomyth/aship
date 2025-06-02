/**
 * Tests for HostManager
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { DirectoryManager } from '../../../src/config/directory-manager.js';
import { HostManager } from '../../../src/host/host-manager.js';
import type { HostConfig, RecentConnection } from '../../../src/schemas/host-config.js';

describe('HostManager', () => {
  let hostManager: HostManager;
  let directoryManager: DirectoryManager;
  let tempDir: string;
  let originalHome: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aship-test-'));

    // Create a test DirectoryManager that uses our temp directory
    class TestDirectoryManager extends DirectoryManager {
      constructor() {
        super();
        // Override the globalDir to use our temp directory
        (this as any).globalDir = path.join(tempDir, '.aship');
      }
      
      get cacheDir(): string {
        return path.join((this as any).globalDir, 'cache');
      }
      
      get configDir(): string {
        return path.join((this as any).globalDir, 'config');
      }
      
      get ansibleConfigFile(): string {
        return path.join(this.configDir, 'ansible.manifest.json');
      }
      
      get ansibleParamsFile(): string {
        return this.ansibleConfigFile;
      }
    }

    directoryManager = new TestDirectoryManager();
    hostManager = new HostManager(directoryManager);

    // Initialize directory structure
    await directoryManager.initialize();
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
    it('should create HostManager instance', () => {
      expect(hostManager).toBeInstanceOf(HostManager);
    });
  });

  describe('getHosts', () => {
    it('should return empty array when no hosts exist', async () => {
      const hosts = await hostManager.getHosts();
      expect(hosts).toEqual([]);
    });

    it('should return hosts from hosts.yml', async () => {
      // Create a test hosts.yml file
      const hostsConfig = {
        hosts: {
          'test-host': {
            name: 'test-host',
            hostname: 'test.example.com',
            user: 'testuser',
            port: 22,
            description: 'Test host',
            created_at: '2023-01-01T00:00:00.000Z',
            source: 'manual',
            connection_success_at: '2023-01-01T00:00:00.000Z',
          },
        },
      };

      await fs.writeFile(
        directoryManager.hostsFile,
        JSON.stringify(hostsConfig, null, 2)
      );

      const hosts = await hostManager.getHosts();
      expect(hosts).toHaveLength(1);
      expect(hosts[0].name).toBe('test-host');
      expect(hosts[0].hostname).toBe('test.example.com');
    });
  });

  describe('getHost', () => {
    it('should return null for non-existent host', async () => {
      const host = await hostManager.getHost('non-existent');
      expect(host).toBeNull();
    });

    it('should return host by name', async () => {
      // Add a host first
      const hostData = {
        hostname: 'test.example.com',
        user: 'testuser',
        port: 22,
        description: 'Test host',
        source: 'manual' as const,
      };

      await hostManager.addHost(hostData);

      const host = await hostManager.getHost('test.example.com');
      expect(host).not.toBeNull();
      expect(host?.hostname).toBe('test.example.com');
    });
  });

  describe('addHost', () => {
    it('should add a new host', async () => {
      const hostData = {
        hostname: 'test.example.com',
        user: 'testuser',
        port: 22,
        description: 'Test host',
        source: 'manual' as const,
      };

      const addedHost = await hostManager.addHost(hostData);

      expect(addedHost.name).toBe('test.example.com');
      expect(addedHost.hostname).toBe('test.example.com');
      expect(addedHost.user).toBe('testuser');
      expect(addedHost.created_at).toBeDefined();
      expect(addedHost.connection_success_at).toBeDefined();
    });

    it('should throw error for duplicate host', async () => {
      const hostData = {
        hostname: 'test.example.com',
        user: 'testuser',
        port: 22,
        description: 'Test host',
        source: 'manual' as const,
      };

      await hostManager.addHost(hostData);

      await expect(hostManager.addHost(hostData)).rejects.toThrow(
        'Host "test.example.com" already exists'
      );
    });
  });

  describe('removeHost', () => {
    it('should remove an existing host', async () => {
      const hostData = {
        hostname: 'test.example.com',
        user: 'testuser',
        port: 22,
        description: 'Test host',
        source: 'manual' as const,
      };

      await hostManager.addHost(hostData);
      
      // Verify host exists
      const hostBefore = await hostManager.getHost('test.example.com');
      expect(hostBefore).not.toBeNull();

      // Remove host
      await hostManager.removeHost('test.example.com');

      // Verify host is gone
      const hostAfter = await hostManager.getHost('test.example.com');
      expect(hostAfter).toBeNull();
    });

    it('should throw error for non-existent host', async () => {
      await expect(hostManager.removeHost('non-existent')).rejects.toThrow(
        'Host "non-existent" not found'
      );
    });
  });

  describe('updateUsage', () => {
    it('should create new usage entry', async () => {
      await hostManager.updateUsage('test-host');

      const usage = await hostManager.getUsageHistory();
      expect(usage['test-host']).toBeDefined();
      expect(usage['test-host'].use_count).toBe(1);
      expect(usage['test-host'].first_used).toBeDefined();
      expect(usage['test-host'].last_used).toBeDefined();
    });

    it('should increment existing usage', async () => {
      // First usage
      await hostManager.updateUsage('test-host');
      
      // Second usage
      await hostManager.updateUsage('test-host');

      const usage = await hostManager.getUsageHistory();
      expect(usage['test-host'].use_count).toBe(2);
    });
  });

  describe('recent connection', () => {
    it('should save and retrieve recent connection', async () => {
      const recentConnection: RecentConnection = {
        host: 'test.example.com',
        user: 'testuser',
        port: 22,
        lastInputTime: new Date().toISOString(),
        connectionAttempts: 1,
      };

      await hostManager.saveRecentConnection(recentConnection);

      const retrieved = await hostManager.getRecentConnection();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.host).toBe('test.example.com');
      expect(retrieved?.user).toBe('testuser');
    });

    it('should return null when no recent connection exists', async () => {
      const recent = await hostManager.getRecentConnection();
      expect(recent).toBeNull();
    });

    it('should clear recent connection', async () => {
      const recentConnection: RecentConnection = {
        host: 'test.example.com',
        user: 'testuser',
        port: 22,
        lastInputTime: new Date().toISOString(),
        connectionAttempts: 1,
      };

      await hostManager.saveRecentConnection(recentConnection);
      
      // Verify it exists
      const before = await hostManager.getRecentConnection();
      expect(before).not.toBeNull();

      // Clear it
      await hostManager.clearRecentConnection();

      // Verify it's gone
      const after = await hostManager.getRecentConnection();
      expect(after).toBeNull();
    });
  });

  describe('getHostChoices', () => {
    it('should return manual option when no hosts exist', async () => {
      const choices = await hostManager.getHostChoices();
      
      expect(choices).toHaveLength(1);
      expect(choices[0].source).toBe('manual');
      expect(choices[0].value).toBe('manual');
    });

    it('should include recent connection as default', async () => {
      // Add recent connection
      const recentConnection: RecentConnection = {
        host: 'recent.example.com',
        user: 'recentuser',
        port: 22,
        lastInputTime: new Date().toISOString(),
        lastConnectionSuccess: true,
        connectionAttempts: 1,
      };

      await hostManager.saveRecentConnection(recentConnection);

      const choices = await hostManager.getHostChoices();
      
      // Should have recent connection + manual option
      expect(choices.length).toBeGreaterThanOrEqual(2);
      
      const recentChoice = choices.find(c => c.source === 'recent');
      expect(recentChoice).toBeDefined();
      expect(recentChoice?.isDefault).toBe(true);
      expect(recentChoice?.host).toBe('recent.example.com');
    });

    it('should include saved hosts', async () => {
      // Add a saved host
      const hostData = {
        hostname: 'saved.example.com',
        user: 'saveduser',
        port: 22,
        description: 'Saved host',
        source: 'manual' as const,
      };

      await hostManager.addHost(hostData);

      const choices = await hostManager.getHostChoices();
      
      const savedChoice = choices.find(c => c.source === 'aship_host');
      expect(savedChoice).toBeDefined();
      expect(savedChoice?.host).toBe('saved.example.com');
      expect(savedChoice?.user).toBe('saveduser');
    });
  });
});
