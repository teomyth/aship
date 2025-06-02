/**
 * Tests for InventoryGenerator
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DirectoryManager } from '../../config/directory-manager.js';
import { HostManager } from '../../host/host-manager.js';
import type { HostConfig } from '../../schemas/host-config.js';
import { InventoryGenerator } from '../inventory-generator.js';

describe('InventoryGenerator', () => {
  let tempDir: string;
  let directoryManager: DirectoryManager;
  let hostManager: HostManager;
  let generator: InventoryGenerator;

  beforeEach(async () => {
    // Create temporary directory for tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aship-inventory-test-'));
    directoryManager = new DirectoryManager(tempDir);
    hostManager = new HostManager(directoryManager);
    generator = new InventoryGenerator(hostManager);

    // Initialize directory structure
    await directoryManager.initialize();

    // Create empty hosts.yml to ensure clean state
    const emptyHostsConfig = { hosts: {} };
    await fs.writeFile(
      directoryManager.hostsFile,
      JSON.stringify(emptyHostsConfig, null, 2),
      'utf-8'
    );
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('generateInventory', () => {
    it('should generate empty inventory when no hosts exist', async () => {
      const inventory = await generator.generateInventory();

      expect(inventory).toEqual({
        all: {
          hosts: {},
          children: {
            aship_hosts: {
              hosts: {},
            },
          },
        },
      });
    });

    it('should generate inventory with hosts', async () => {
      // Add test hosts
      const host1: HostConfig = {
        name: 'web-server',
        hostname: 'web.example.com',
        user: 'deploy',
        port: 22,
        identity_file: '~/.ssh/web_key',
        description: 'Web server',
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'manual',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      const host2: HostConfig = {
        name: 'db-server',
        hostname: 'db.example.com',
        user: 'admin',
        port: 3306,
        description: 'Database server',
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'ssh_config',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      await hostManager.addHost(host1, 'web-server');
      await hostManager.addHost(host2, 'db-server');

      const inventory = await generator.generateInventory();

      expect(inventory.all.hosts).toEqual({
        'web-server': {
          ansible_host: 'web.example.com',
          ansible_user: 'deploy',
          ansible_port: 22,
          ansible_ssh_private_key_file: '~/.ssh/web_key',
          ansible_ssh_common_args: '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
        },
        'db-server': {
          ansible_host: 'db.example.com',
          ansible_user: 'admin',
          ansible_port: 3306,
          ansible_ssh_common_args: '-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null',
        },
      });

      expect(inventory.all.children).toEqual({
        aship_hosts: {
          hosts: {
            'web-server': {},
            'db-server': {},
          },
        },
      });
    });

    it('should filter hosts by source', async () => {
      const host1: HostConfig = {
        name: 'manual-host',
        hostname: 'manual.example.com',
        user: 'user1',
        port: 22,
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'manual',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      const host2: HostConfig = {
        name: 'ssh-host',
        hostname: 'ssh.example.com',
        user: 'user2',
        port: 22,
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'ssh_config',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      await hostManager.addHost(host1, 'manual-host');
      await hostManager.addHost(host2, 'ssh-host');

      const inventory = await generator.generateInventory({ source: 'manual' });

      expect(Object.keys(inventory.all.hosts)).toEqual(['manual-host']);
      expect(Object.keys(inventory.all.children.aship_hosts.hosts)).toEqual(['manual-host']);
    });

    it('should filter hosts by name pattern', async () => {
      const host1: HostConfig = {
        name: 'web-prod-1',
        hostname: 'web1.prod.example.com',
        user: 'deploy',
        port: 22,
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'manual',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      const host2: HostConfig = {
        name: 'db-prod-1',
        hostname: 'db1.prod.example.com',
        user: 'deploy',
        port: 22,
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'manual',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      await hostManager.addHost(host1, 'web-prod-1');
      await hostManager.addHost(host2, 'db-prod-1');

      const inventory = await generator.generateInventory({ filter: 'web' });

      expect(Object.keys(inventory.all.hosts)).toEqual(['web-prod-1']);
    });

    it('should use custom group name', async () => {
      const host: HostConfig = {
        name: 'test-host',
        hostname: 'test.example.com',
        user: 'test',
        port: 22,
        created_at: '2023-01-01T00:00:00.000Z',
        source: 'manual',
        connection_success_at: '2023-01-01T00:00:00.000Z',
      };

      await hostManager.addHost(host, 'test-host');

      const inventory = await generator.generateInventory({ groupName: 'custom_group' });

      expect(inventory.all.children).toEqual({
        custom_group: {
          hosts: {
            'test-host': {},
          },
        },
      });
    });
  });

  describe('formatInventory', () => {
    it('should format inventory as YAML', () => {
      const inventory = {
        all: {
          hosts: {
            'test-host': {
              ansible_host: 'test.example.com',
              ansible_user: 'test',
              ansible_port: 22,
            },
          },
          children: {
            aship_hosts: {
              hosts: {
                'test-host': {},
              },
            },
          },
        },
      };

      const yaml = generator.formatInventory(inventory, 'yaml');
      expect(yaml).toContain('all:');
      expect(yaml).toContain('hosts:');
      expect(yaml).toContain('test-host:');
      expect(yaml).toContain('ansible_host: test.example.com');
    });

    it('should format inventory as JSON', () => {
      const inventory = {
        all: {
          hosts: {
            'test-host': {
              ansible_host: 'test.example.com',
              ansible_user: 'test',
              ansible_port: 22,
            },
          },
          children: {
            aship_hosts: {
              hosts: {
                'test-host': {},
              },
            },
          },
        },
      };

      const json = generator.formatInventory(inventory, 'json');
      const parsed = JSON.parse(json);
      expect(parsed).toEqual(inventory);
    });
  });

  describe('saveInventory', () => {
    it('should save inventory to file', async () => {
      const inventory = {
        all: {
          hosts: {
            'test-host': {
              ansible_host: 'test.example.com',
              ansible_user: 'test',
              ansible_port: 22,
            },
          },
          children: {
            aship_hosts: {
              hosts: {
                'test-host': {},
              },
            },
          },
        },
      };

      const filePath = path.join(tempDir, 'test-inventory.yml');
      await generator.saveInventory(filePath, inventory);

      const content = await fs.readFile(filePath, 'utf-8');
      expect(content).toContain('all:');
      expect(content).toContain('test-host:');
    });
  });

  describe('loadInventory', () => {
    it('should load YAML inventory file', async () => {
      const yamlContent = `
all:
  hosts:
    test-host:
      ansible_host: test.example.com
      ansible_user: test
      ansible_port: 22
  children:
    existing_group:
      hosts:
        test-host: {}
`;

      const filePath = path.join(tempDir, 'existing-inventory.yml');
      await fs.writeFile(filePath, yamlContent, 'utf-8');

      const inventory = await generator.loadInventory(filePath);

      expect(inventory.all.hosts['test-host']).toEqual({
        ansible_host: 'test.example.com',
        ansible_user: 'test',
        ansible_port: 22,
      });
    });

    it('should load JSON inventory file', async () => {
      const jsonContent = {
        all: {
          hosts: {
            'test-host': {
              ansible_host: 'test.example.com',
              ansible_user: 'test',
              ansible_port: 22,
            },
          },
          children: {
            existing_group: {
              hosts: {
                'test-host': {},
              },
            },
          },
        },
      };

      const filePath = path.join(tempDir, 'existing-inventory.json');
      await fs.writeFile(filePath, JSON.stringify(jsonContent, null, 2), 'utf-8');

      const inventory = await generator.loadInventory(filePath);

      expect(inventory.all.hosts['test-host']).toEqual({
        ansible_host: 'test.example.com',
        ansible_user: 'test',
        ansible_port: 22,
      });
    });
  });
});
