/**
 * File system testing assistance tools
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach } from 'vitest';

/**
 * Create a temporary test directory
 * @returns Temporary directory path
 */
export function createTempDir(prefix = 'aship-test-'): string {
  const tempDir = path.join(
    os.tmpdir(),
    `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
  );

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  return tempDir;
}

/**
 * Clean up temporary directories
 * @param dirPath Temporary directory path
 */
export function cleanupTempDir(dirPath: string): void {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

/**
 * Create a test file
 * @param dirPath Directory path
 * @param fileName file name
 * @param content File content
 * @returns Complete file path
 */
export function createTestFile(dirPath: string, fileName: string, content: string): string {
  const filePath = path.join(dirPath, fileName);
  const fileDir = path.dirname(filePath);

  if (!fs.existsSync(fileDir)) {
    fs.mkdirSync(fileDir, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
  return filePath;
}

/**
 * Create a test directory structure
 * @param baseDir Basic Directory
 * @param structure Directory structure object, key is path, value is file content (string) or null (representing directory)
 */
export function createTestStructure(
  baseDir: string,
  structure: Record<string, string | null>
): void {
  for (const [relativePath, content] of Object.entries(structure)) {
    const fullPath = path.join(baseDir, relativePath);

    if (content === null) {
      // Create a directory
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    } else {
      // Create a file
      const dirPath = path.dirname(fullPath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      fs.writeFileSync(fullPath, content);
    }
  }
}

/**
 * Test auxiliary classes for managing temporary directories and files
 */
export class TestFileSystem {
  private tempDirs: string[] = [];

  /**
   * Create a temporary directory
   * @param prefix Directory prefix
   * @returns Temporary directory path
   */
  createTempDir(prefix = 'aship-test-'): string {
    const tempDir = createTempDir(prefix);
    this.tempDirs.push(tempDir);
    return tempDir;
  }

  /**
   * Create a test file
   * @param dirPath Directory path
   * @param fileName file name
   * @param content File content
   * @returns Complete file path
   */
  createTestFile(dirPath: string, fileName: string, content: string): string {
    return createTestFile(dirPath, fileName, content);
  }

  /**
   * Create a test directory structure
   * @param baseDir Basic Directory
   * @param structure Directory structure object
   */
  createTestStructure(baseDir: string, structure: Record<string, string | null>): void {
    createTestStructure(baseDir, structure);
  }

  /**
   * Clean up all temporary directories
   */
  cleanup(): void {
    for (const dir of this.tempDirs) {
      cleanupTempDir(dir);
    }
    this.tempDirs = [];
  }
}

/**
 * Create test file system helper objects and automatically clean up after the test is finished
 * @returns Test file system helper objects
 */
export function useTestFileSystem(): TestFileSystem {
  const fs = new TestFileSystem();

  afterEach(() => {
    fs.cleanup();
  });

  return fs;
}

/**
 * Create and manage temporary directories for test suites
 * @param setup Optional setting function, called after creating a temporary directory
 * @returns Temporary directory path
 */
export function useTempDir(setup?: (tempDir: string) => void): () => string {
  let tempDir: string;

  beforeEach(() => {
    tempDir = createTempDir();
    if (setup) {
      setup(tempDir);
    }
  });

  afterEach(() => {
    cleanupTempDir(tempDir);
  });

  return () => tempDir;
}
