/**
 * Unit tests for SSH permissions module
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  PermissionLevel,
  checkPermissionLevel,
  displayPermissionInfo,
  isRoot,
  hasSudo,
} from '../../../src/ssh/permissions.js';
import type { SSHConnection } from '../../../src/ssh/connection.js';

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock chalk
vi.mock('chalk', () => ({
  default: {
    green: vi.fn((text: string) => text),
    yellow: vi.fn((text: string) => text),
    blue: vi.fn((text: string) => text),
    red: vi.fn((text: string) => text),
  },
}));

describe('SSH Permissions', () => {
  let mockConnection: SSHConnection;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock SSH connection
    mockConnection = {
      exec: vi.fn(),
    } as any;
  });

  describe('PermissionLevel enum', () => {
    it('should have correct values', () => {
      expect(PermissionLevel.ROOT).toBe('root');
      expect(PermissionLevel.SUDO).toBe('sudo');
      expect(PermissionLevel.NORMAL).toBe('normal');
      expect(PermissionLevel.UNKNOWN).toBe('unknown');
    });
  });

  describe('isRoot', () => {
    it('should return true when user is root (id -u command)', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec.mockResolvedValueOnce({
        stdout: '0',
        stderr: '',
        exitCode: 0,
      });

      // Act
      const result = await isRoot(mockConnection);

      // Assert
      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith('id -u');
    });

    it('should return false when user is not root', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec.mockResolvedValueOnce({
        stdout: '1000',
        stderr: '',
        exitCode: 0,
      });

      // Act
      const result = await isRoot(mockConnection);

      // Assert
      expect(result).toBe(false);
      expect(mockExec).toHaveBeenCalledWith('id -u');
    });



    it('should return false when commands fail', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec.mockRejectedValue(new Error('Command failed'));

      // Act
      const result = await isRoot(mockConnection);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('hasSudo', () => {
    it('should return true when user has sudo privileges', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      // Act
      const result = await hasSudo(mockConnection);

      // Assert
      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith('sudo -n true 2>/dev/null');
    });

    it('should return false when user does not have sudo privileges', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec
        .mockRejectedValueOnce(new Error('sudo failed'))
        .mockResolvedValueOnce({
          stdout: 'user : user',
          stderr: '',
          exitCode: 0,
        });

      // Act
      const result = await hasSudo(mockConnection);

      // Assert
      expect(result).toBe(false);
      expect(mockExec).toHaveBeenCalledWith('sudo -n true 2>/dev/null');
      expect(mockExec).toHaveBeenCalledWith('groups');
    });

    it('should return true when user is in sudo group', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec
        .mockRejectedValueOnce(new Error('sudo failed'))
        .mockResolvedValueOnce({
          stdout: 'user : user sudo wheel',
          stderr: '',
          exitCode: 0,
        });

      // Act
      const result = await hasSudo(mockConnection);

      // Assert
      expect(result).toBe(true);
      expect(mockExec).toHaveBeenCalledWith('groups');
    });

    it('should return false when sudo command fails', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec
        .mockRejectedValueOnce(new Error('sudo: command not found'))
        .mockRejectedValueOnce(new Error('groups: command not found'));

      // Act
      const result = await hasSudo(mockConnection);

      // Assert
      expect(result).toBe(false);
    });


  });

  describe('checkPermissionLevel', () => {
    it('should return ROOT when user is root', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec.mockResolvedValueOnce({
        stdout: '0',
        stderr: '',
        exitCode: 0,
      });

      // Act
      const result = await checkPermissionLevel(mockConnection);

      // Assert
      expect(result).toBe(PermissionLevel.ROOT);
    });

    it('should return SUDO when user has sudo privileges but is not root', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec
        .mockResolvedValueOnce({
          stdout: '1000',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

      // Act
      const result = await checkPermissionLevel(mockConnection);

      // Assert
      expect(result).toBe(PermissionLevel.SUDO);
    });

    it('should return NORMAL when user has no elevated privileges', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec
        .mockResolvedValueOnce({
          stdout: '1000',
          stderr: '',
          exitCode: 0,
        })
        .mockRejectedValueOnce(new Error('sudo failed'))
        .mockResolvedValueOnce({
          stdout: 'user : user',
          stderr: '',
          exitCode: 0,
        });

      // Act
      const result = await checkPermissionLevel(mockConnection);

      // Assert
      expect(result).toBe(PermissionLevel.NORMAL);
    });

    it('should return NORMAL when both isRoot and hasSudo fail', async () => {
      // Arrange
      const mockExec = vi.mocked(mockConnection.exec);
      mockExec
        .mockRejectedValueOnce(new Error('Connection failed')) // isRoot fails
        .mockRejectedValueOnce(new Error('sudo failed')) // hasSudo first call fails
        .mockRejectedValueOnce(new Error('groups failed')); // hasSudo second call fails

      // Act
      const result = await checkPermissionLevel(mockConnection);

      // Assert
      expect(result).toBe(PermissionLevel.NORMAL);
    });
  });

  describe('displayPermissionInfo', () => {
    it('should not throw errors for any permission level', () => {
      // Act & Assert - Just verify the function doesn't throw
      expect(() => displayPermissionInfo(PermissionLevel.ROOT)).not.toThrow();
      expect(() => displayPermissionInfo(PermissionLevel.SUDO)).not.toThrow();
      expect(() => displayPermissionInfo(PermissionLevel.NORMAL)).not.toThrow();
      expect(() => displayPermissionInfo(PermissionLevel.UNKNOWN)).not.toThrow();
    });
  });
});
