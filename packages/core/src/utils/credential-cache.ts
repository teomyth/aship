/**
 * Credential cache manager
 * Provides functionality to securely cache credentials in memory
 */

import logger from './logger.js';

/**
 * Cached credential entry
 */
interface CachedCredential {
  /**
   * Credential value (password or key path)
   */
  value: string;

  /**
   * Credential type (password or key)
   */
  type: 'password' | 'key';

  /**
   * Expiry timestamp (milliseconds since epoch)
   */
  expiresAt: number;
}

/**
 * Credential cache key
 */
type CredentialCacheKey = string;

/**
 * Credential cache manager
 */
class CredentialCacheManager {
  /**
   * Cached credentials
   * Map of host-user to credential
   */
  private cache: Map<CredentialCacheKey, CachedCredential> = new Map();

  /**
   * Default cache timeout in milliseconds (15 minutes)
   */
  private defaultTimeout = 15 * 60 * 1000;

  /**
   * Parse timeout string to milliseconds
   * @param timeout Timeout string (e.g. '15m', '1h', '30s')
   * @returns Timeout in milliseconds
   */
  parseTimeout(timeout: string): number {
    if (!timeout) {
      return this.defaultTimeout;
    }

    // Parse timeout string (e.g. '15m', '1h', '30s')
    const match = timeout.match(/^(\d+)([smh])$/);
    if (!match) {
      logger.warn(`Invalid timeout format: ${timeout}. Using default timeout.`);
      return this.defaultTimeout;
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        return this.defaultTimeout;
    }
  }

  /**
   * Generate cache key from host and username
   * @param host Host
   * @param username Username
   * @returns Cache key
   */
  private generateKey(host: string, username: string): CredentialCacheKey {
    return `${username}@${host}`;
  }

  /**
   * Store credential in cache
   * @param host Host
   * @param username Username
   * @param type Credential type
   * @param value Credential value
   * @param timeout Timeout in milliseconds or timeout string
   */
  storeCredential(
    host: string,
    username: string,
    type: 'password' | 'key',
    value: string,
    timeout?: number | string
  ): void {
    const key = this.generateKey(host, username);

    // Parse timeout if it's a string
    let timeoutMs = this.defaultTimeout;
    if (typeof timeout === 'number') {
      timeoutMs = timeout;
    } else if (typeof timeout === 'string') {
      timeoutMs = this.parseTimeout(timeout);
    }

    const expiresAt = Date.now() + timeoutMs;

    this.cache.set(key, {
      value,
      type,
      expiresAt,
    });

    // Log cache expiry time
    const expiryDate = new Date(expiresAt);
    logger.debug(`Cached ${type} for ${username}@${host} until ${expiryDate.toLocaleTimeString()}`);
  }

  /**
   * Get credential from cache
   * @param host Host
   * @param username Username
   * @returns Credential or undefined if not found or expired
   */
  getCredential(
    host: string,
    username: string
  ): { type: 'password' | 'key'; value: string; expiresAt: number } | undefined {
    const key = this.generateKey(host, username);
    const cached = this.cache.get(key);

    if (!cached) {
      return undefined;
    }

    // Check if expired
    if (cached.expiresAt < Date.now()) {
      logger.debug(`Cached credential for ${username}@${host} has expired`);
      this.cache.delete(key);
      return undefined;
    }

    return cached;
  }

  /**
   * Clear all cached credentials
   */
  clearAll(): void {
    this.cache.clear();
    logger.debug('Cleared all cached credentials');
  }

  /**
   * Clear cached credential for specific host and username
   * @param host Host
   * @param username Username
   */
  clearCredential(host: string, username: string): void {
    const key = this.generateKey(host, username);
    this.cache.delete(key);
    logger.debug(`Cleared cached credential for ${username}@${host}`);
  }

  /**
   * Get remaining time for cached credential
   * @param host Host
   * @param username Username
   * @returns Remaining time in milliseconds or undefined if not found
   */
  getRemainingTime(host: string, username: string): number | undefined {
    const credential = this.getCredential(host, username);

    if (!credential) {
      return undefined;
    }

    return credential.expiresAt - Date.now();
  }

  /**
   * Format remaining time for display
   * @param remainingMs Remaining time in milliseconds
   * @returns Formatted time string
   */
  formatRemainingTime(remainingMs: number): string {
    if (remainingMs < 0) {
      return 'expired';
    }

    const minutes = Math.ceil(remainingMs / 60000);

    if (minutes < 60) {
      return `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }
}

// Create singleton instance
const credentialCache = new CredentialCacheManager();

export default credentialCache;
