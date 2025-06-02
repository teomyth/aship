/**
 * Cache management utilities
 * Provides unified interface for managing different types of caches
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileExists } from './fs.js';
import logger from './logger.js';

/**
 * Cache types supported by the system
 */
export type CacheType = 'connections';

/**
 * Information about a cache
 */
export interface CacheInfo {
  type: CacheType;
  location: string;
  size: number;
  lastModified: Date;
  itemCount: number;
  description: string;
}

/**
 * Options for clearing cache
 */
export interface ClearOptions {
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Options for pruning cache
 */
export interface PruneOptions {
  dryRun?: boolean;
  maxAge?: number; // in milliseconds
}

/**
 * Cache manager class
 */
export class CacheManager {
  private readonly globalCacheDir: string;

  constructor() {
    this.globalCacheDir = path.join(os.homedir(), '.aship');
  }

  /**
   * Get information about all caches
   */
  async listCaches(): Promise<CacheInfo[]> {
    const caches: CacheInfo[] = [];

    // Check global caches
    const globalCaches = [
      {
        type: 'connections' as CacheType,
        file: 'connection-history.json',
        desc: 'Connection history',
      },
    ];

    for (const cache of globalCaches) {
      const cachePath = path.join(this.globalCacheDir, cache.file);
      if (await fileExists(cachePath)) {
        caches.push(await this.getCacheInfo(cache.type, cachePath, cache.desc));
      }
    }

    return caches;
  }

  /**
   * Clear specific type of cache
   */
  async clearCache(type: CacheType, options: ClearOptions = {}): Promise<void> {
    const { dryRun = false } = options;

    switch (type) {
      case 'connections':
        await this.clearConnectionCache(dryRun);
        break;
      default:
        throw new Error(`Unknown cache type: ${type}`);
    }
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(options: ClearOptions = {}): Promise<void> {
    const cacheTypes: CacheType[] = ['connections'];

    for (const type of cacheTypes) {
      try {
        await this.clearCache(type, options);
      } catch (error) {
        logger.warn(
          `Failed to clear ${type} cache: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  }

  /**
   * Prune expired/unused cache entries
   */
  async pruneCache(options: PruneOptions = {}): Promise<void> {
    const { dryRun = false, maxAge = 30 * 24 * 60 * 60 * 1000 } = options; // 30 days default

    const cutoffTime = Date.now() - maxAge;

    // Prune connections
    await this.pruneConnections(cutoffTime, dryRun);
  }

  /**
   * Get cache information for a specific file
   */
  private async getCacheInfo(
    type: CacheType,
    filePath: string,
    description: string
  ): Promise<CacheInfo> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to parse YAML to count items
      let itemCount = 0;
      try {
        const yaml = await import('js-yaml');
        const data = yaml.load(content);
        if (Array.isArray(data)) {
          itemCount = data.length;
        } else if (typeof data === 'object' && data !== null) {
          itemCount = Object.keys(data).length;
        }
      } catch {
        // If parsing fails, estimate based on lines
        itemCount = content.split('\n').filter(line => line.trim()).length;
      }

      return {
        type,
        location: filePath,
        size: stats.size,
        lastModified: stats.mtime,
        itemCount,
        description,
      };
    } catch (_error) {
      return {
        type,
        location: filePath,
        size: 0,
        lastModified: new Date(0),
        itemCount: 0,
        description: `${description} (error reading file)`,
      };
    }
  }

  /**
   * Clear project variable cache
   */
  private async clearVariableCache(dryRun: boolean): Promise<void> {
    const varsPath = path.join(process.cwd(), '.aship', 'vars.yml');

    if (await fileExists(varsPath)) {
      if (dryRun) {
        logger.info(`Would remove: ${varsPath}`);
      } else {
        await fs.unlink(varsPath);
        logger.info(`Cleared project variable cache: ${varsPath}`);
      }
    } else {
      logger.info('No project variable cache found');
    }
  }

  /**
   * Clear connection cache
   */
  private async clearConnectionCache(dryRun: boolean): Promise<void> {
    const connectionsPath = path.join(this.globalCacheDir, 'connection-history.json');

    if (await fileExists(connectionsPath)) {
      if (dryRun) {
        logger.info(`Would remove: ${connectionsPath}`);
      } else {
        await fs.unlink(connectionsPath);
        logger.info(`Cleared connection cache: ${connectionsPath}`);
      }
    } else {
      logger.info('No connection cache found');
    }
  }

  /**
   * Get detailed connection information
   */
  async getConnectionDetails(): Promise<any[]> {
    const connectionsPath = path.join(this.globalCacheDir, 'connection-history.json');

    if (!(await fileExists(connectionsPath))) {
      return [];
    }

    try {
      const content = await fs.readFile(connectionsPath, 'utf-8');

      // Check if file is empty or contains only whitespace
      if (!content.trim()) {
        logger.debug('Connection details file is empty, returning empty array');
        return [];
      }

      try {
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
          return data;
        }

        return [];
      } catch (parseError) {
        logger.warn(
          `Failed to parse connection details JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
        logger.debug(`File content: ${content}`);
        // Backup corrupted file
        const backupPath = `${connectionsPath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, content, 'utf-8');
        logger.warn(`Corrupted connection details backed up to: ${backupPath}`);
        return [];
      }
    } catch (error) {
      logger.warn(
        `Failed to read connection details: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  /**
   * Prune old connection entries
   */
  private async pruneConnections(cutoffTime: number, dryRun: boolean): Promise<void> {
    const connectionsPath = path.join(this.globalCacheDir, 'connection-history.json');

    if (!(await fileExists(connectionsPath))) {
      return;
    }

    try {
      const content = await fs.readFile(connectionsPath, 'utf-8');

      // Check if file is empty or contains only whitespace
      if (!content.trim()) {
        logger.debug('Connection file is empty, nothing to prune');
        return;
      }

      try {
        const data = JSON.parse(content);

        if (Array.isArray(data)) {
          const filtered = data.filter((conn: any) => conn.lastUsed && conn.lastUsed > cutoffTime);

          const removedCount = data.length - filtered.length;

          if (removedCount > 0) {
            if (dryRun) {
              logger.info(`Would remove ${removedCount} old connection entries`);
            } else {
              await fs.writeFile(connectionsPath, JSON.stringify(filtered, null, 2));
              logger.info(`Pruned ${removedCount} old connection entries`);
            }
          }
        }
      } catch (parseError) {
        logger.warn(
          `Failed to parse connections JSON for pruning: ${parseError instanceof Error ? parseError.message : String(parseError)}`
        );
        logger.debug(`File content: ${content}`);
        // Don't backup here since this is a pruning operation
      }
    } catch (error) {
      logger.warn(
        `Failed to prune connections: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

export default cacheManager;
