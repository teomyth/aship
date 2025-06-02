/**
 * File system utility testing
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  directoryExists,
  ensureDirectoryExists,
  fileExists,
  fileExistsAsync,
  listFiles,
  readTextFile,
  writeTextFile,
} from '../../../src/utils/fs.js';
import { useTempDir } from '../../helpers/fs-helper.js';

describe('File system utilities', () => {
  // Create and manage temporary directories using helper functions
  const getTempDir = useTempDir();

  // Use this function in the test to get the current temporary directory path
  function TEST_DIR() {
    return getTempDir();
  }

  describe('fileExists', () => {
    it('should return true for existing files', () => {
      // Create a test file
      const testFile = path.join(TEST_DIR(), 'test-file.txt');
      fs.writeFileSync(testFile, 'test content');

      expect(fileExists(testFile)).toBe(true);
    });

    it('should return false for non-existent files', () => {
      const nonExistentFile = path.join(TEST_DIR(), 'non-existent-file.txt');
      expect(fileExists(nonExistentFile)).toBe(false);
    });

    it('should return false for directories', () => {
      expect(fileExists(TEST_DIR())).toBe(false);
    });
  });

  describe('fileExistsAsync', () => {
    it('should return true for existing files', async () => {
      // Create a test file
      const testFile = path.join(TEST_DIR(), 'test-file-async.txt');
      fs.writeFileSync(testFile, 'test content');

      expect(await fileExistsAsync(testFile)).toBe(true);
    });

    it('should return false for non-existent files', async () => {
      const nonExistentFile = path.join(TEST_DIR(), 'non-existent-file-async.txt');
      expect(await fileExistsAsync(nonExistentFile)).toBe(false);
    });

    it('should return false for directories', async () => {
      expect(await fileExistsAsync(TEST_DIR())).toBe(false);
    });
  });

  describe('directoryExists', () => {
    it('should return true for existing directories', () => {
      expect(directoryExists(TEST_DIR())).toBe(true);
    });

    it('should return false for non-existent directories', () => {
      const nonExistentDir = path.join(TEST_DIR(), 'non-existent-dir');
      expect(directoryExists(nonExistentDir)).toBe(false);
    });

    it('should return false for files', () => {
      // Create a test file
      const testFile = path.join(TEST_DIR(), 'test-file.txt');
      fs.writeFileSync(testFile, 'test content');

      expect(directoryExists(testFile)).toBe(false);
    });
  });

  describe('ensureDirectoryExists', () => {
    it('should create directory if it does not exist', () => {
      const newDir = path.join(TEST_DIR(), 'new-dir');

      // Make sure the directory does not exist
      if (fs.existsSync(newDir)) {
        fs.rmSync(newDir, { recursive: true });
      }

      expect(fs.existsSync(newDir)).toBe(false);

      // Call function
      ensureDirectoryExists(newDir);

      // Created a check directory
      expect(fs.existsSync(newDir)).toBe(true);
      expect(fs.statSync(newDir).isDirectory()).toBe(true);
    });

    it('should not throw if directory already exists', () => {
      expect(() => ensureDirectoryExists(TEST_DIR())).not.toThrow();
    });

    it('should create nested directories', () => {
      const nestedDir = path.join(TEST_DIR(), 'nested', 'dir', 'structure');

      // Make sure the directory does not exist
      if (fs.existsSync(path.join(TEST_DIR(), 'nested'))) {
        fs.rmSync(path.join(TEST_DIR(), 'nested'), { recursive: true });
      }

      expect(fs.existsSync(nestedDir)).toBe(false);

      // Call function
      ensureDirectoryExists(nestedDir);

      // Created a check directory
      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.statSync(nestedDir).isDirectory()).toBe(true);
    });
  });

  describe('readTextFile', () => {
    it('should read file content as text', () => {
      // Create a test file
      const testFile = path.join(TEST_DIR(), 'test-file.txt');
      const content = 'test content';
      fs.writeFileSync(testFile, content);

      expect(readTextFile(testFile)).toBe(content);
    });

    it('should throw error for non-existent files', () => {
      const nonExistentFile = path.join(TEST_DIR(), 'non-existent-file.txt');
      expect(() => readTextFile(nonExistentFile)).toThrow();
    });
  });

  describe('writeTextFile', () => {
    it('should write content to file', () => {
      const testFile = path.join(TEST_DIR(), 'write-test.txt');
      const content = 'test content for writing';

      // Make sure the file does not exist
      if (fs.existsSync(testFile)) {
        fs.unlinkSync(testFile);
      }

      // Write a file
      writeTextFile(testFile, content);

      // Created a check file with the correct content
      expect(fs.existsSync(testFile)).toBe(true);
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(content);
    });

    it('should create parent directories if they do not exist', () => {
      const nestedFile = path.join(TEST_DIR(), 'nested', 'dir', 'file.txt');
      const content = 'nested file content';

      // Make sure the parent directory does not exist
      if (fs.existsSync(path.join(TEST_DIR(), 'nested'))) {
        fs.rmSync(path.join(TEST_DIR(), 'nested'), { recursive: true });
      }

      // Write a file
      writeTextFile(nestedFile, content);

      // Created a check file with the correct content
      expect(fs.existsSync(nestedFile)).toBe(true);
      expect(fs.readFileSync(nestedFile, 'utf-8')).toBe(content);
    });

    it('should overwrite existing file', () => {
      const testFile = path.join(TEST_DIR(), 'overwrite-test.txt');
      const initialContent = 'initial content';
      const newContent = 'new content';

      // Create a file with initial content
      fs.writeFileSync(testFile, initialContent);

      // Overwrite the file
      writeTextFile(testFile, newContent);

      // Check that the file is overwritten
      expect(fs.readFileSync(testFile, 'utf-8')).toBe(newContent);
    });
  });

  describe('listFiles', () => {
    beforeEach(() => {
      // Create test files and directories
      const files = [
        'file1.txt',
        'file2.txt',
        'file3.json',
        'nested/file4.txt',
        'nested/file5.json',
      ];

      files.forEach(file => {
        const filePath = path.join(TEST_DIR(), file);
        ensureDirectoryExists(path.dirname(filePath));
        fs.writeFileSync(filePath, `Content of ${file}`);
      });
    });

    it('should list all files in a directory', () => {
      const files = listFiles(TEST_DIR());

      expect(files.length).toBe(3); // Files in the root directory only
      expect(files.some(f => f.endsWith('file1.txt'))).toBe(true);
      expect(files.some(f => f.endsWith('file2.txt'))).toBe(true);
      expect(files.some(f => f.endsWith('file3.json'))).toBe(true);
    });

    it('should filter files by extension', () => {
      const txtFiles = listFiles(TEST_DIR(), '.txt');

      expect(txtFiles.length).toBe(2);
      expect(txtFiles.every(f => f.endsWith('.txt'))).toBe(true);

      const jsonFiles = listFiles(TEST_DIR(), '.json');

      expect(jsonFiles.length).toBe(1);
      expect(jsonFiles.every(f => f.endsWith('.json'))).toBe(true);
    });

    it('should return empty array for non-existent directory', () => {
      const nonExistentDir = path.join(TEST_DIR(), 'non-existent-dir');
      expect(listFiles(nonExistentDir)).toEqual([]);
    });

    it('should list files in nested directory', () => {
      const nestedDir = path.join(TEST_DIR(), 'nested');
      const files = listFiles(nestedDir);

      expect(files.length).toBe(2);
      expect(files.some(f => f.endsWith('file4.txt'))).toBe(true);
      expect(files.some(f => f.endsWith('file5.json'))).toBe(true);
    });
  });
});
