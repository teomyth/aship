/**
 * Host manager for managing host connections
 */

import * as fs from 'node:fs/promises';
import * as yaml from 'js-yaml';
import type { DirectoryManager } from '../config/directory-manager.js';
import {
  type HostChoice,
  type HostConfig,
  type HostUsage,
  type HostUsageHistory,
  type HostsConfig,
  type RecentConnection,
  createDefaultHostUsageHistory,
  createDefaultHostsConfig,
  validateHostUsageHistory,
  validateHostsConfig,
  validateRecentConnection,
} from '../schemas/host-config.js';

/**
 * Host manager class - replaces ServerManager with simplified host management
 */
export class HostManager {
  private hostsConfig: HostsConfig | null = null;
  private usageHistory: HostUsageHistory | null = null;

  constructor(private directoryManager: DirectoryManager) {}

  /**
   * Load hosts configuration from hosts.yml
   */
  private async loadHostsConfig(): Promise<HostsConfig> {
    if (!this.hostsConfig) {
      await this.directoryManager.initialize();

      try {
        // 检查文件是否存在，如果不存在则创建默认配置
        if (await this.directoryManager.fileExists(this.directoryManager.hostsFile)) {
          const content = await fs.readFile(this.directoryManager.hostsFile, 'utf-8');
          const parsed = yaml.load(content) || {};
          const validation = validateHostsConfig(parsed);

          if (validation.success && validation.data) {
            this.hostsConfig = validation.data;
          } else {
            console.warn('⚠️  Some hosts have configuration issues and will be skipped:');
            validation.errors?.forEach(error => {
              console.warn(`   • ${error}`);
            });
            console.warn(
              '   💡 Run "aship host list" to see valid hosts or "aship host add" to add new ones'
            );
            this.hostsConfig = createDefaultHostsConfig();
            // 保存默认配置，确保文件存在
            await this.saveHostsConfig(this.hostsConfig);
          }
        } else {
          this.hostsConfig = createDefaultHostsConfig();
          // 文件不存在，创建默认配置文件
          await this.saveHostsConfig(this.hostsConfig);
        }
      } catch (error) {
        console.warn('Failed to load hosts configuration, using defaults:', error);
        this.hostsConfig = createDefaultHostsConfig();
        try {
          // 尝试保存默认配置，确保下次运行正常
          await this.saveHostsConfig(this.hostsConfig);
        } catch (saveError) {
          console.warn('Failed to save default hosts configuration:', saveError);
        }
      }
    }

    return this.hostsConfig;
  }

  /**
   * Save hosts configuration to hosts.yml
   */
  private async saveHostsConfig(config: HostsConfig): Promise<void> {
    await this.directoryManager.initialize();
    const yamlContent = yaml.dump(config, { indent: 2 });
    await fs.writeFile(this.directoryManager.hostsFile, yamlContent, 'utf-8');
    this.hostsConfig = config;
  }

  /**
   * Load usage history from host-usage.json
   */
  private async loadUsageHistory(): Promise<HostUsageHistory> {
    if (!this.usageHistory) {
      await this.directoryManager.initialize();

      try {
        if (await this.directoryManager.fileExists(this.directoryManager.hostUsageFile)) {
          const content = await fs.readFile(this.directoryManager.hostUsageFile, 'utf-8');
          const parsed = JSON.parse(content);
          const validation = validateHostUsageHistory(parsed);

          if (validation.success && validation.data) {
            this.usageHistory = validation.data;
          } else {
            console.warn('Invalid usage history, using defaults:', validation.errors);
            this.usageHistory = createDefaultHostUsageHistory();
            // 保存默认使用历史，确保文件存在
            await this.saveUsageHistory(this.usageHistory);
          }
        } else {
          this.usageHistory = createDefaultHostUsageHistory();
          // 文件不存在，创建默认使用历史文件
          await this.saveUsageHistory(this.usageHistory);
        }
      } catch (error) {
        console.warn('Failed to load usage history, using defaults:', error);
        this.usageHistory = createDefaultHostUsageHistory();
        try {
          // 尝试保存默认使用历史，确保下次运行正常
          await this.saveUsageHistory(this.usageHistory);
        } catch (saveError) {
          console.warn('Failed to save default usage history:', saveError);
        }
      }
    }

    return this.usageHistory;
  }

  /**
   * Save usage history to host-usage.json
   */
  private async saveUsageHistory(usage: HostUsageHistory): Promise<void> {
    await this.directoryManager.initialize();
    const jsonContent = JSON.stringify(usage, null, 2);
    await fs.writeFile(this.directoryManager.hostUsageFile, jsonContent, 'utf-8');
    this.usageHistory = usage;
  }

  /**
   * Get all hosts (only from hosts.yml - unified source)
   */
  async getHosts(): Promise<HostConfig[]> {
    const config = await this.loadHostsConfig();
    return Object.values(config.hosts);
  }

  /**
   * Get a specific host by name
   */
  async getHost(name: string): Promise<HostConfig | null> {
    const config = await this.loadHostsConfig();
    return config.hosts[name] || null;
  }

  /**
   * Add a new host (only successful connections are saved)
   */
  async addHost(
    hostData: Omit<HostConfig, 'name' | 'created_at' | 'connection_success_at'>,
    customName?: string
  ): Promise<HostConfig> {
    const config = await this.loadHostsConfig();

    // Use custom name if provided, otherwise use hostname as fallback
    const hostName = customName || hostData.hostname;

    // Check if host already exists
    if (config.hosts[hostName]) {
      throw new Error(`Host "${hostName}" already exists`);
    }

    const now = new Date().toISOString();
    const newHost: HostConfig = {
      name: hostName,
      created_at: now,
      connection_success_at: now,
      ...hostData,
    };

    // Add host to configuration
    const updatedConfig: HostsConfig = {
      hosts: {
        ...config.hosts,
        [hostName]: newHost,
      },
    };

    await this.saveHostsConfig(updatedConfig);
    return newHost;
  }

  /**
   * Remove a host
   */
  async removeHost(name: string): Promise<void> {
    const config = await this.loadHostsConfig();

    if (!config.hosts[name]) {
      throw new Error(`Host "${name}" not found`);
    }

    // Remove from hosts
    const updatedHosts = { ...config.hosts };
    delete updatedHosts[name];

    const updatedConfig: HostsConfig = {
      hosts: updatedHosts,
    };

    await this.saveHostsConfig(updatedConfig);

    // Also remove from usage history
    const usage = await this.loadUsageHistory();
    if (usage[name]) {
      const updatedUsage = { ...usage };
      delete updatedUsage[name];
      await this.saveUsageHistory(updatedUsage);
    }
  }

  /**
   * Update host usage statistics
   */
  async updateUsage(hostName: string): Promise<void> {
    const usage = await this.loadUsageHistory();
    const now = new Date().toISOString();

    const currentUsage = usage[hostName];
    const updatedUsage: HostUsage = {
      first_used: currentUsage?.first_used || now,
      last_used: now,
      use_count: (currentUsage?.use_count || 0) + 1,
    };

    const updatedHistory: HostUsageHistory = {
      ...usage,
      [hostName]: updatedUsage,
    };

    await this.saveUsageHistory(updatedHistory);
  }

  /**
   * Get usage history
   */
  async getUsageHistory(): Promise<HostUsageHistory> {
    return await this.loadUsageHistory();
  }

  /**
   * Get recent connection
   */
  async getRecentConnection(): Promise<RecentConnection | null> {
    await this.directoryManager.initialize();

    try {
      if (!(await this.directoryManager.fileExists(this.directoryManager.recentConnectionFile))) {
        // 文件不存在时返回null，这是正常行为
        return null;
      }

      const content = await fs.readFile(this.directoryManager.recentConnectionFile, 'utf-8');
      const parsed = JSON.parse(content);
      const validation = validateRecentConnection(parsed);

      if (validation.success && validation.data) {
        return validation.data;
      }
      console.warn('Invalid recent connection format:', validation.errors);
      // 创建一个空的recentConnectionFile文件，以确保目录结构完整
      await fs.writeFile(this.directoryManager.recentConnectionFile, '{}', 'utf-8');
      return null;
    } catch (error) {
      console.warn('Failed to load recent connection:', error);
      try {
        // 创建一个空的recentConnectionFile文件，以确保目录结构完整
        await fs.writeFile(this.directoryManager.recentConnectionFile, '{}', 'utf-8');
      } catch (writeError) {
        console.warn('Failed to create empty recent connection file:', writeError);
      }
      return null;
    }
  }

  /**
   * Save recent connection (overwrites previous)
   */
  async saveRecentConnection(connection: RecentConnection): Promise<void> {
    await this.directoryManager.initialize();
    const jsonContent = JSON.stringify(connection, null, 2);
    await fs.writeFile(this.directoryManager.recentConnectionFile, jsonContent, 'utf-8');
  }

  /**
   * Clear recent connection
   */
  async clearRecentConnection(): Promise<void> {
    try {
      await fs.unlink(this.directoryManager.recentConnectionFile);
    } catch (_error) {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Get host choices for interactive selection
   * Simplified flow: recent connection > aship hosts > manual input
   */
  async getHostChoices(): Promise<HostChoice[]> {
    const choices: HostChoice[] = [];

    // 1. Recent connection (highest priority, default selection)
    const recent = await this.getRecentConnection();
    if (recent) {
      const recentDisplay = recent.user ? `${recent.user}@${recent.host}` : recent.host;
      const portInfo = recent.port && recent.port !== 22 ? `:${recent.port}` : '';

      // Use lastConnectionAttempt or lastInputTime as the usage timestamp
      // Convert to timestamp for consistent comparison
      const lastUsed = recent.lastConnectionAttempt || recent.lastInputTime;
      const lastUsedTimestamp = new Date(lastUsed).getTime();

      choices.push({
        name: `${recentDisplay}${portInfo} (recent input)`,
        value: `recent:${recent.host}`,
        source: 'recent',
        isDefault: true,
        host: recent.host,
        user: recent.user,
        port: recent.port,
        lastUsed: lastUsedTimestamp,
        description: recent.lastConnectionSuccess
          ? 'Recent successful connection'
          : 'Recent failed connection (retry)',
      });
    }

    // 2. Saved hosts (from hosts.yml)
    const hosts = await this.getHosts();
    const usage = await this.getUsageHistory();

    // Sort hosts by last used (most recent first)
    const sortedHosts = hosts.sort((a, b) => {
      const aLastUsed = usage[a.name]?.last_used || '0';
      const bLastUsed = usage[b.name]?.last_used || '0';
      return bLastUsed.localeCompare(aLastUsed);
    });

    for (const host of sortedHosts) {
      const userInfo = host.user ? `${host.user}@` : '';
      const portInfo = host.port && host.port !== 22 ? `:${host.port}` : '';

      // Convert last_used to timestamp for consistent comparison
      const hostUsage = usage[host.name];
      const lastUsedTimestamp = hostUsage?.last_used
        ? new Date(hostUsage.last_used).getTime()
        : undefined;

      choices.push({
        name: `${host.name} (${userInfo}${host.hostname}${portInfo})`,
        value: host.name,
        source: 'aship_host',
        host: host.hostname,
        user: host.user,
        port: host.port,
        lastUsed: lastUsedTimestamp,
        description: host.description || `Used ${hostUsage?.use_count || 0} times`,
      });
    }

    // 3. Manual input option
    choices.push({
      name: 'Enter new host...',
      value: 'manual',
      source: 'manual',
      description: 'Input a new host manually',
    });

    // Sort choices by lastUsed timestamp (most recent first)
    // Keep manual option at the end
    const manualChoice = choices.pop(); // Remove manual option temporarily

    const sortedChoices = choices.sort((a, b) => {
      // If both have lastUsed timestamps, sort by them
      if (a.lastUsed && b.lastUsed) {
        return b.lastUsed - a.lastUsed; // Most recent first
      }
      // If only one has lastUsed, prioritize it
      if (a.lastUsed && !b.lastUsed) return -1;
      if (!a.lastUsed && b.lastUsed) return 1;
      // If neither has lastUsed, maintain original order
      return 0;
    });

    // Add manual option back at the end
    if (manualChoice) {
      sortedChoices.push(manualChoice);
    }

    return sortedChoices;
  }

  /**
   * 百度兼容方法
   *
   * 注意：我们不再考虑向后兼容，该方法已经不再需要
   */
  async migrateLegacyConfig(): Promise<void> {
    // 不再需要向后兼容，所以不执行任何操作
    return;
  }
}
