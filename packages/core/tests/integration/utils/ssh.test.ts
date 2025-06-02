/**
 * Basic SSH utilities tests
 *
 * Note: For comprehensive SSH connection tests, see ssh-integration.test.ts
 */

import { describe, expect, it } from 'vitest';
import { getAllSshKeys } from '../../../src/utils/ssh.js';

// Mock fs module for testing
import { vi, beforeEach } from 'vitest';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(),
}));

import * as fs from 'node:fs';
import * as os from 'node:os';

describe('SSH utilities basic tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllSshKeys', () => {
    it('should return an array of SSH keys', () => {
      // Mock the home directory
      const mockHomedir = vi.mocked(os.homedir);
      mockHomedir.mockReturnValue('/home/testuser');

      // Mock fs.existsSync to return true for .ssh directory
      const mockExistsSync = vi.mocked(fs.existsSync);
      mockExistsSync.mockReturnValue(true);

      // Mock fs.readdirSync to return some test SSH keys
      const mockReaddirSync = vi.mocked(fs.readdirSync);
      mockReaddirSync.mockReturnValue(['id_rsa', 'id_rsa.pub', 'id_ed25519', 'id_ed25519.pub'] as any);

      const keys = getAllSshKeys();

      // Verify that the function returns an array
      expect(Array.isArray(keys)).toBe(true);

      // Verify that it returns all standard SSH key types that exist
      // The function checks for ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'] in order
      expect(keys).toEqual([
        '/home/testuser/.ssh/id_rsa',
        '/home/testuser/.ssh/id_ed25519',
        '/home/testuser/.ssh/id_ecdsa',
        '/home/testuser/.ssh/id_dsa'
      ]);
    });

    it('should return empty array when .ssh directory does not exist', () => {
      // Mock the home directory
      const mockHomedir = vi.mocked(os.homedir);
      mockHomedir.mockReturnValue('/home/testuser');

      // Mock fs.existsSync to return false for .ssh directory
      const mockExistsSync = vi.mocked(fs.existsSync);
      mockExistsSync.mockReturnValue(false);

      const keys = getAllSshKeys();

      // Should return empty array when .ssh directory doesn't exist
      expect(keys).toEqual([]);
    });
  });
});
