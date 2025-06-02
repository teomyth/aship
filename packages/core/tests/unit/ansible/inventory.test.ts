import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateInventoryContent, generateInventoryFile } from '../../../src/ansible/inventory.js';

// Mock fs.writeFile
vi.mock('node:fs/promises', () => {
  return {
    default: {
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
    writeFile: vi.fn().mockResolvedValue(undefined),
  };
});

// Mock os.tmpdir
vi.mock('node:os', async () => {
  return {
    default: {
      tmpdir: vi.fn().mockReturnValue('/tmp'),
    },
    tmpdir: vi.fn().mockReturnValue('/tmp'),
  };
});

describe('Ansible inventory generator', () => {
  const mockServers = [
    {
      name: 'server1',
      hostname: 'example.com',
      port: 22,
      user: 'admin',
      // Password authentication - no identity_file
    },
    {
      name: 'server2',
      hostname: 'example2.com',
      port: 2222,
      user: 'user',
      identity_file: '/path/to/key',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateInventoryContent', () => {
    it('should generate correct inventory content for password authentication', async () => {
      const content = await generateInventoryContent([mockServers[0]]);

      expect(content).toContain(
        'server1 ansible_host=example.com ansible_port=22 ansible_user=admin'
      );
      expect(content).toContain('[all:vars]');
      expect(content).toContain('ansible_connection=ssh');
      expect(content).toContain('ansible_become=yes');
      // Password authentication is handled by session manager, not in inventory
      expect(content).not.toContain('ansible_ssh_pass');
    });

    it('should generate correct inventory content for SSH key authentication', async () => {
      const content = await generateInventoryContent([mockServers[1]]);

      expect(content).toContain(
        'server2 ansible_host=example2.com ansible_port=2222 ansible_user=user'
      );
      expect(content).toContain('ansible_ssh_private_key_file=/path/to/key');
      expect(content).not.toContain('ansible_ssh_pass');
    });

    it('should generate correct inventory content for multiple servers', async () => {
      const content = await generateInventoryContent(mockServers);

      expect(content).toContain('server1 ansible_host=example.com');
      expect(content).toContain('server2 ansible_host=example2.com');
    });
  });

  // generateInventoryFile 测试已移至集成测试
});
