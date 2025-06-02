/**
 * Integration tests for Ansible inventory generator
 */

import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { generateInventoryFile } from '../../../src/ansible/inventory.js';
import { TestFileSystem } from '../../helpers/fs-helper.js';

describe('Ansible inventory generator integration tests', () => {
  const testFs = new TestFileSystem();

  describe('generateInventoryFile', () => {
    it('should create a temporary file with the correct content', async () => {
      // Mock servers
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

      // Generate inventory file
      const filePath = await generateInventoryFile(mockServers);

      // Check that the file exists
      expect(fs.existsSync(filePath)).toBe(true);

      // Read the file content
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check the content
      expect(content).toContain(
        'server1 ansible_host=example.com ansible_port=22 ansible_user=admin'
      );
      // Password authentication is handled by session manager, not in inventory
      expect(content).not.toContain('ansible_ssh_pass');

      expect(content).toContain(
        'server2 ansible_host=example2.com ansible_port=2222 ansible_user=user'
      );
      expect(content).toContain('ansible_ssh_private_key_file=/path/to/key');

      expect(content).toContain('[all:vars]');
      expect(content).toContain('ansible_connection=ssh');
      expect(content).toContain('ansible_become=yes');

      // Clean up the file
      fs.unlinkSync(filePath);
    });
  });
});
