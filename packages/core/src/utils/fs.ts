/**
 * File system utilities
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';

/**
 * Check if a file exists
 * @param filePath Path to the file
 * @returns True if the file exists, false otherwise
 */
function fileExists(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch (_error) {
    return false;
  }
}

/**
 * Check if a file exists (async version)
 * @param filePath Path to the file
 * @returns Promise that resolves to true if the file exists, false otherwise
 */
async function fileExistsAsync(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isFile();
  } catch (_error) {
    return false;
  }
}

/**
 * Check if a directory exists
 * @param dirPath Path to the directory
 * @returns True if the directory exists, false otherwise
 */
function directoryExists(dirPath: string): boolean {
  try {
    return statSync(dirPath).isDirectory();
  } catch (_error) {
    return false;
  }
}

/**
 * Create a directory and any parent directories if they don't exist
 * @param dirPath Path to the directory
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!directoryExists(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Read a file as text
 * @param filePath Path to the file
 * @returns File contents as a string
 */
function readTextFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

/**
 * Write text to a file
 * @param filePath Path to the file
 * @param content Content to write
 */
function writeTextFile(filePath: string, content: string): void {
  // Ensure the parent directory exists
  const dirPath = dirname(filePath);
  ensureDirectoryExists(dirPath);

  // Write the file
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * List files in a directory
 * @param dirPath Path to the directory
 * @param extension Optional file extension filter
 * @returns Array of file paths
 */
function listFiles(dirPath: string, extension?: string): string[] {
  if (!directoryExists(dirPath)) {
    return [];
  }

  const files = readdirSync(dirPath);
  const filePaths = files.map((file: string) => join(dirPath, file));

  if (extension) {
    return filePaths.filter((file: string) => fileExists(file) && extname(file) === extension);
  }

  return filePaths.filter((file: string) => fileExists(file));
}

export {
  fileExists,
  fileExistsAsync,
  directoryExists,
  ensureDirectoryExists,
  readTextFile,
  writeTextFile,
  listFiles,
};
