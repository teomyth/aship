/**
 * Helper functions for testing configuration file operations
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { vi } from 'vitest';

/**
 * Create a temporary directory for configuration files
 * @returns Path to the temporary directory
 */
export function createTempConfigDir(): string {
  const tempDir = path.join(os.tmpdir(), `aship-test-${uuidv4()}`);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Create a temporary connections file
 * @param initialContent Initial content for the connections file
 * @returns Path to the temporary connections file
 */
export function createTempConnectionsFile(initialContent: any = { connections: [], lastUsed: null }): string {
  const tempDir = createTempConfigDir();
  const filePath = path.join(tempDir, 'connections.json');
  fs.writeFileSync(filePath, JSON.stringify(initialContent, null, 2), 'utf-8');
  return filePath;
}

/**
 * Clean up a temporary directory
 * @param dirPath Path to the temporary directory
 */
export function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      if (fs.statSync(filePath).isDirectory()) {
        cleanupTempDir(filePath);
      } else {
        fs.unlinkSync(filePath);
      }
    }
    fs.rmdirSync(dirPath);
  }
}

/**
 * Read a JSON file
 * @param filePath Path to the JSON file
 * @returns Parsed JSON content
 */
export function readJsonFile(filePath: string): any {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get a temporary directory to use as home directory
 * @returns Path to the temporary directory
 */
export function getTempHomeDir(): string {
  return createTempConfigDir();
}
