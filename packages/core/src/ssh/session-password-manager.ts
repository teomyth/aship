/**
 * Session password manager
 * Manages passwords in memory during a session
 */

/**
 * Session password manager
 * Stores passwords in memory during a session
 */
export class SessionPasswordManager {
  /**
   * Map of passwords
   * Key format: user@host
   */
  private passwords: Map<string, string> = new Map();

  /**
   * Save a password
   * @param host Host
   * @param user User
   * @param password Password
   */
  savePassword(host: string, user: string, password: string): void {
    const key = `${user}@${host}`;
    this.passwords.set(key, password);
  }

  /**
   * Get a password
   * @param host Host
   * @param user User
   * @returns Password or undefined if not found
   */
  getPassword(host: string, user: string): string | undefined {
    const key = `${user}@${host}`;
    return this.passwords.get(key);
  }

  /**
   * Check if a password exists
   * @param host Host
   * @param user User
   * @returns True if password exists
   */
  hasPassword(host: string, user: string): boolean {
    const key = `${user}@${host}`;
    return this.passwords.has(key);
  }

  /**
   * Clear a password
   * @param host Host
   * @param user User
   */
  clearPassword(host: string, user: string): void {
    const key = `${user}@${host}`;
    this.passwords.delete(key);
  }

  /**
   * Clear all passwords
   */
  clearAll(): void {
    this.passwords.clear();
  }
}

/**
 * Global session password manager instance
 */
export const sessionPasswordManager = new SessionPasswordManager();
