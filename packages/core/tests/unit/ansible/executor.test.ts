/**
 * Tests for Ansible executor
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnsibleExecutor, dependencies } from '../../../src/ansible/executor.js';

// Mock fs.unlink
vi.mock('node:fs/promises', () => ({
  unlink: vi.fn().mockResolvedValue(undefined),
}));

// Mock child_process.spawn
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock inventory generator
vi.mock('../../../src/ansible/inventory.js', () => ({
  generateInventoryFile: vi.fn(),
}));

describe('AnsibleExecutor', () => {
  const executor = new AnsibleExecutor();
  const mockServers = [
    {
      name: 'server1',
      host: 'example.com',
      port: 22,
      user: 'admin',
      auth: {
        type: 'password' as const,
        value: 'password123',
      },
    },
    {
      name: 'server2',
      host: 'example2.com',
      port: 2222,
      user: 'user',
      auth: {
        type: 'key' as const,
        value: '/path/to/key',
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    dependencies.fileExists = vi.fn().mockReturnValue(true);
    dependencies.generateInventoryFile = vi.fn().mockResolvedValue('/tmp/mock-inventory.ini');
    dependencies.spawn = vi.fn().mockReturnValue({
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === 'close') {
          setTimeout(() => callback(0), 10);
        }
      }),
    });
    dependencies.fs = { unlink: vi.fn().mockResolvedValue(undefined) } as any;
  });

  describe('executePlaybook', () => {
    it('should validate required options', async () => {
      // Test missing servers
      const result1 = await executor.executePlaybook({
        servers: [],
        playbook: 'test.yml',
      });

      expect(result1.success).toBe(false);
      expect(result1.stderr).toContain('No target servers specified');

      // Test missing playbook
      const result2 = await executor.executePlaybook({
        servers: mockServers,
        playbook: '',
      } as any);

      expect(result2.success).toBe(false);
      expect(result2.stderr).toContain('No playbook specified');
    });

    it('should validate playbook existence', async () => {
      dependencies.fileExists = vi.fn().mockReturnValue(false);

      const result = await executor.executePlaybook({
        servers: mockServers,
        playbook: 'nonexistent.yml',
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Playbook not found');
    });

    it('should generate inventory file and execute playbook', async () => {
      // Override the mocks for this test
      const generateInventoryFile = vi.fn().mockResolvedValue('/tmp/mock-inventory.ini');
      vi.mocked(dependencies.generateInventoryFile).mockImplementation(generateInventoryFile);

      const spawn = vi.fn().mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      });
      vi.mocked(dependencies.spawn).mockImplementation(spawn);

      const unlink = vi.fn().mockResolvedValue(undefined);
      vi.mocked(dependencies.fs.unlink).mockImplementation(unlink);

      const result = await executor.executePlaybook({
        servers: mockServers,
        playbook: 'test.yml',
        verbose: 2,
        extraVars: { foo: 'bar' },
      });

      // Check that inventory file was generated
      expect(generateInventoryFile).toHaveBeenCalledWith(mockServers);

      // Check that ansible-playbook was called with correct arguments
      expect(spawn).toHaveBeenCalledTimes(1);
      const [command, args] = spawn.mock.calls[0];

      expect(command).toBe('ansible-playbook');
      expect(args).toContain('-i');
      expect(args).toContain('/tmp/mock-inventory.ini');
      expect(args).toContain('-vv');
      expect(args).toContain('--extra-vars');
      expect(args).toContain(JSON.stringify({ foo: 'bar' }));
      expect(args).toContain('--become');
      expect(args).toContain('test.yml');

      // Check that inventory file was cleaned up
      expect(unlink).toHaveBeenCalledWith('/tmp/mock-inventory.ini');

      // Check result
      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
    });

    it('should handle inventory generation errors', async () => {
      // Override the mock for this test
      const generateInventoryFile = vi.fn().mockRejectedValueOnce(new Error('Inventory error'));
      vi.mocked(dependencies.generateInventoryFile).mockImplementation(generateInventoryFile);

      const result = await executor.executePlaybook({
        servers: mockServers,
        playbook: 'test.yml',
      });

      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Failed to generate inventory file');
      expect(result.stderr).toContain('Inventory error');
    });

    it('should handle inventory cleanup errors', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Make unlink fail
      const unlink = vi.fn().mockRejectedValueOnce(new Error('Cleanup error'));
      vi.mocked(dependencies.fs.unlink).mockImplementation(unlink);

      // Setup other mocks for this test
      const generateInventoryFile = vi.fn().mockResolvedValue('/tmp/mock-inventory.ini');
      vi.mocked(dependencies.generateInventoryFile).mockImplementation(generateInventoryFile);

      const spawn = vi.fn().mockReturnValue({
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn().mockImplementation((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
      });
      vi.mocked(dependencies.spawn).mockImplementation(spawn);

      const result = await executor.executePlaybook({
        servers: mockServers,
        playbook: 'test.yml',
      });

      expect(result.success).toBe(true); // Execution should still succeed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove temporary inventory file')
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Cleanup error'));

      consoleSpy.mockRestore();
    });
  });
});
