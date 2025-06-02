/**
 * Unit tests for SessionPasswordManager
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { SessionPasswordManager, sessionPasswordManager } from '../../../src/ssh/session-password-manager.js';

describe('SessionPasswordManager', () => {
  let manager: SessionPasswordManager;

  beforeEach(() => {
    manager = new SessionPasswordManager();
  });

  describe('savePassword', () => {
    it('should save a password for a host and user', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';

      // Act
      manager.savePassword(host, user, password);

      // Assert
      expect(manager.hasPassword(host, user)).toBe(true);
      expect(manager.getPassword(host, user)).toBe(password);
    });

    it('should overwrite existing password for same host and user', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const oldPassword = 'oldpass';
      const newPassword = 'newpass';

      // Act
      manager.savePassword(host, user, oldPassword);
      manager.savePassword(host, user, newPassword);

      // Assert
      expect(manager.getPassword(host, user)).toBe(newPassword);
    });

    it('should handle different users on same host', () => {
      // Arrange
      const host = 'example.com';
      const user1 = 'user1';
      const user2 = 'user2';
      const password1 = 'pass1';
      const password2 = 'pass2';

      // Act
      manager.savePassword(host, user1, password1);
      manager.savePassword(host, user2, password2);

      // Assert
      expect(manager.getPassword(host, user1)).toBe(password1);
      expect(manager.getPassword(host, user2)).toBe(password2);
    });

    it('should handle same user on different hosts', () => {
      // Arrange
      const host1 = 'host1.com';
      const host2 = 'host2.com';
      const user = 'testuser';
      const password1 = 'pass1';
      const password2 = 'pass2';

      // Act
      manager.savePassword(host1, user, password1);
      manager.savePassword(host2, user, password2);

      // Assert
      expect(manager.getPassword(host1, user)).toBe(password1);
      expect(manager.getPassword(host2, user)).toBe(password2);
    });
  });

  describe('getPassword', () => {
    it('should return undefined for non-existent password', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';

      // Act & Assert
      expect(manager.getPassword(host, user)).toBeUndefined();
    });

    it('should return the correct password for existing entry', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';
      manager.savePassword(host, user, password);

      // Act & Assert
      expect(manager.getPassword(host, user)).toBe(password);
    });

    it('should be case-sensitive for host and user', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';
      manager.savePassword(host, user, password);

      // Act & Assert
      expect(manager.getPassword('EXAMPLE.COM', user)).toBeUndefined();
      expect(manager.getPassword(host, 'TESTUSER')).toBeUndefined();
      expect(manager.getPassword(host, user)).toBe(password);
    });
  });

  describe('hasPassword', () => {
    it('should return false for non-existent password', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';

      // Act & Assert
      expect(manager.hasPassword(host, user)).toBe(false);
    });

    it('should return true for existing password', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';
      manager.savePassword(host, user, password);

      // Act & Assert
      expect(manager.hasPassword(host, user)).toBe(true);
    });

    it('should return false after password is cleared', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';
      manager.savePassword(host, user, password);

      // Act
      manager.clearPassword(host, user);

      // Assert
      expect(manager.hasPassword(host, user)).toBe(false);
    });
  });

  describe('clearPassword', () => {
    it('should clear a specific password', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';
      manager.savePassword(host, user, password);

      // Act
      manager.clearPassword(host, user);

      // Assert
      expect(manager.hasPassword(host, user)).toBe(false);
      expect(manager.getPassword(host, user)).toBeUndefined();
    });

    it('should not affect other passwords', () => {
      // Arrange
      const host1 = 'host1.com';
      const host2 = 'host2.com';
      const user = 'testuser';
      const password1 = 'pass1';
      const password2 = 'pass2';
      manager.savePassword(host1, user, password1);
      manager.savePassword(host2, user, password2);

      // Act
      manager.clearPassword(host1, user);

      // Assert
      expect(manager.hasPassword(host1, user)).toBe(false);
      expect(manager.hasPassword(host2, user)).toBe(true);
      expect(manager.getPassword(host2, user)).toBe(password2);
    });

    it('should handle clearing non-existent password gracefully', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';

      // Act & Assert
      expect(() => manager.clearPassword(host, user)).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('should clear all passwords', () => {
      // Arrange
      manager.savePassword('host1.com', 'user1', 'pass1');
      manager.savePassword('host2.com', 'user2', 'pass2');
      manager.savePassword('host3.com', 'user3', 'pass3');

      // Act
      manager.clearAll();

      // Assert
      expect(manager.hasPassword('host1.com', 'user1')).toBe(false);
      expect(manager.hasPassword('host2.com', 'user2')).toBe(false);
      expect(manager.hasPassword('host3.com', 'user3')).toBe(false);
    });

    it('should handle clearing empty manager gracefully', () => {
      // Act & Assert
      expect(() => manager.clearAll()).not.toThrow();
    });
  });

  describe('key format', () => {
    it('should use correct key format (user@host)', () => {
      // Arrange
      const host = 'example.com';
      const user = 'testuser';
      const password = 'testpass123';

      // Act
      manager.savePassword(host, user, password);

      // Assert - Test internal key format by checking edge cases
      expect(manager.hasPassword(host, user)).toBe(true);
      
      // Test with user containing @ symbol
      const userWithAt = 'test@domain';
      manager.savePassword(host, userWithAt, password);
      expect(manager.hasPassword(host, userWithAt)).toBe(true);
      expect(manager.hasPassword(host, user)).toBe(true); // Original should still exist
    });
  });
});

describe('Global sessionPasswordManager', () => {
  it('should be a singleton instance', () => {
    // Act & Assert
    expect(sessionPasswordManager).toBeInstanceOf(SessionPasswordManager);
  });

  it('should maintain state across imports', () => {
    // Arrange
    const host = 'example.com';
    const user = 'testuser';
    const password = 'testpass123';

    // Act
    sessionPasswordManager.savePassword(host, user, password);

    // Assert
    expect(sessionPasswordManager.hasPassword(host, user)).toBe(true);
    expect(sessionPasswordManager.getPassword(host, user)).toBe(password);

    // Cleanup
    sessionPasswordManager.clearAll();
  });
});
