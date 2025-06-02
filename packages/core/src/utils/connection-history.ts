/**
 * Connection history manager
 * Provides functionality to save and load connection history
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileExists } from './fs.js';
import logger from './logger.js';

/**
 * Connection history entry
 */
export interface ConnectionHistoryEntry {
  /**
   * Host
   */
  host: string;

  /**
   * Username
   */
  username: string;

  /**
   * Port
   */
  port: number;

  /**
   * SSH identity file path (optional)
   */
  identity_file?: string;

  /**
   * Last used timestamp
   */
  lastUsed: number;
}

/**
 * Connection history manager
 */
class ConnectionHistoryManager {
  /**
   * History file path
   */
  private historyFilePath: string;

  /**
   * Connection history
   */
  private history: ConnectionHistoryEntry[] = [];

  /**
   * Maximum history size
   */
  private maxHistorySize = 10;

  /**
   * Initialization promise
   */
  private initPromise: Promise<void>;

  /**
   * Constructor
   */
  constructor() {
    // Create ~/.aship directory if it doesn't exist
    const ashipDir = path.join(os.homedir(), '.aship');
    this.historyFilePath = path.join(ashipDir, 'connection-history.json');

    // Initialize asynchronously
    this.initPromise = this.initialize(ashipDir);
  }

  /**
   * Initialize the connection history manager
   */
  private async initialize(ashipDir: string): Promise<void> {
    try {
      // Ensure directory exists
      await this.ensureDirectoryExists(ashipDir);
      // Load history
      await this.loadHistory();
    } catch (error) {
      logger.error(`Failed to initialize connection history: ${error}`);
    }
  }

  /**
   * Ensure directory exists
   * @param dir Directory path
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      logger.error(`Failed to create directory ${dir}: ${error}`);
    }
  }

  /**
   * Load connection history
   */
  private async loadHistory(): Promise<void> {
    try {
      if (await fileExists(this.historyFilePath)) {
        const historyData = await fs.readFile(this.historyFilePath, 'utf-8');

        // Check if file is empty or contains only whitespace
        if (!historyData.trim()) {
          logger.debug('Connection history file is empty, initializing with empty array');
          this.history = [];
          return;
        }

        try {
          this.history = JSON.parse(historyData);
          logger.debug(`Loaded ${this.history.length} connection history entries`);
        } catch (parseError) {
          logger.error(`Failed to parse connection history JSON: ${parseError}`);
          logger.debug(`File content: ${historyData}`);
          // Backup corrupted file and start fresh
          const backupPath = `${this.historyFilePath}.backup.${Date.now()}`;
          await fs.writeFile(backupPath, historyData, 'utf-8');
          logger.warn(`Corrupted connection history backed up to: ${backupPath}`);
          this.history = [];
        }
      }
    } catch (error) {
      logger.error(`Failed to load connection history: ${error}`);
      this.history = [];
    }
  }

  /**
   * Save connection history
   */
  private async saveHistory(): Promise<void> {
    try {
      await fs.writeFile(this.historyFilePath, JSON.stringify(this.history, null, 2), 'utf-8');
      logger.debug(`Saved ${this.history.length} connection history entries`);
    } catch (error) {
      logger.error(`Failed to save connection history: ${error}`);
    }
  }

  /**
   * Add connection to history
   * @param connection Connection details
   */
  async addConnection(connection: ConnectionHistoryEntry): Promise<void> {
    // Wait for initialization to complete
    await this.initPromise;

    // Skip saving example/test hosts to prevent pollution of connection history
    if (this.isExampleHost(connection.host)) {
      logger.debug(`Skipping example host: ${connection.host}`);
      return;
    }

    // Check if connection already exists
    const existingIndex = this.history.findIndex(
      entry => entry.host === connection.host && entry.username === connection.username
    );

    if (existingIndex !== -1) {
      // Update existing entry
      this.history[existingIndex] = {
        ...connection,
        lastUsed: Date.now(),
      };
    } else {
      // Add new entry
      this.history.push({
        ...connection,
        lastUsed: Date.now(),
      });

      // Trim history if needed
      if (this.history.length > this.maxHistorySize) {
        // Sort by last used (newest first)
        this.history.sort((a, b) => b.lastUsed - a.lastUsed);
        // Keep only the most recent entries
        this.history = this.history.slice(0, this.maxHistorySize);
      }
    }

    // Save history
    await this.saveHistory();
  }

  /**
   * Get connection history
   * @returns Connection history
   */
  async getHistory(): Promise<ConnectionHistoryEntry[]> {
    // Wait for initialization to complete
    await this.initPromise;
    // Sort by last used (newest first)
    return [...this.history].sort((a, b) => b.lastUsed - a.lastUsed);
  }

  /**
   * Get most recent connection
   * @returns Most recent connection or undefined if none
   */
  async getMostRecentConnection(): Promise<ConnectionHistoryEntry | undefined> {
    // Wait for initialization to complete
    await this.initPromise;

    if (this.history.length === 0) {
      return undefined;
    }

    // Sort by last used (newest first)
    const history = await this.getHistory();
    return history[0];
  }

  /**
   * Get connection by host and username
   * @param host Host
   * @param username Username
   * @returns Connection or undefined if not found
   */
  async getConnection(host: string, username: string): Promise<ConnectionHistoryEntry | undefined> {
    // Wait for initialization to complete
    await this.initPromise;
    return this.history.find(entry => entry.host === host && entry.username === username);
  }

  /**
   * Clear connection history
   */
  async clearHistory(): Promise<void> {
    // Wait for initialization to complete
    await this.initPromise;
    this.history = [];
    await this.saveHistory();
  }

  /**
   * Check if a host is an example/test host that should not be saved
   * @param host Host to check
   * @returns True if it's an example host
   */
  private isExampleHost(host: string): boolean {
    const exampleHosts = [
      'example.com',
      'example.org',
      'example.net',
      'test.com',
      'test.org',
      'localhost.example',
      'demo.example.com',
    ];

    return (
      exampleHosts.includes(host.toLowerCase()) ||
      host.toLowerCase().includes('example') ||
      host.toLowerCase().includes('test.example')
    );
  }
}

// Create singleton instance
const connectionHistory = new ConnectionHistoryManager();

export default connectionHistory;
export { ConnectionHistoryManager };
