/**
 * Tests for YAML utilities
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadYamlFile, saveYamlFile } from '../../../src/utils/yaml.js';
import { useTempDir } from '../../helpers/fs-helper.js';

describe('YAML utilities', () => {
  // Create and manage temporary directories using helper functions
  const getTempDir = useTempDir();

  // Use this function in the test to get the current temporary directory path
  function TEST_DIR() {
    return getTempDir();
  }

  describe('loadYamlFile', () => {
    it('should load and parse YAML file', () => {
      // Create a test YAML file
      const testFile = path.join(TEST_DIR(), 'test.yml');
      const yamlContent = `
name: test-project
version: 1.0.0
settings:
  enabled: true
  port: 8080
  hosts:
    - localhost
    - example.com
`;
      fs.writeFileSync(testFile, yamlContent);

      // Load the YAML file
      const result = loadYamlFile(testFile);

      // Check the parsed content
      expect(result).toEqual({
        name: 'test-project',
        version: '1.0.0',
        settings: {
          enabled: true,
          port: 8080,
          hosts: ['localhost', 'example.com'],
        },
      });
    });

    it('should throw error for non-existent files', () => {
      const nonExistentFile = path.join(TEST_DIR(), 'non-existent.yml');
      expect(() => loadYamlFile(nonExistentFile)).toThrow('File not found');
    });

    it('should throw error for invalid YAML', () => {
      // Create a test file with invalid YAML
      const testFile = path.join(TEST_DIR(), 'invalid.yml');
      const invalidContent = `
name: test-project
version: 1.0.0
settings: {
  enabled: true,
  port: 8080,
`;
      fs.writeFileSync(testFile, invalidContent);

      // Try to load the invalid YAML file
      expect(() => loadYamlFile(testFile)).toThrow('Failed to parse YAML file');
    });
  });

  describe('saveYamlFile', () => {
    it('should save data as YAML file', () => {
      const testFile = path.join(TEST_DIR(), 'save-test.yml');
      const data = {
        name: 'test-project',
        version: '1.0.0',
        settings: {
          enabled: true,
          port: 8080,
          hosts: ['localhost', 'example.com'],
        },
      };

      // Save data to YAML file
      saveYamlFile(testFile, data);

      // Check if the file exists
      expect(fs.existsSync(testFile)).toBe(true);

      // Load the file and check its content
      const loadedData = loadYamlFile(testFile);
      expect(loadedData).toEqual(data);
    });

    it('should create parent directories if they do not exist', () => {
      const nestedFile = path.join(TEST_DIR(), 'nested', 'dir', 'config.yml');
      const data = { name: 'nested-config' };

      // Make sure the parent directory does not exist
      if (fs.existsSync(path.join(TEST_DIR(), 'nested'))) {
        fs.rmSync(path.join(TEST_DIR(), 'nested'), { recursive: true });
      }

      // Save data to YAML file
      saveYamlFile(nestedFile, data);

      // Check if the file exists
      expect(fs.existsSync(nestedFile)).toBe(true);

      // Load the file and check its content
      const loadedData = loadYamlFile(nestedFile);
      expect(loadedData).toEqual(data);
    });

    it('should handle complex data structures', () => {
      const testFile = path.join(TEST_DIR(), 'complex.yml');
      const data = {
        name: 'complex-project',
        servers: [
          {
            name: 'server1',
            host: 'example.com',
            port: 22,
            tags: ['production', 'web'],
            config: {
              memory: '4GB',
              cpu: 2,
            },
          },
          {
            name: 'server2',
            host: 'test.com',
            port: 2222,
            tags: ['staging'],
            config: {
              memory: '2GB',
              cpu: 1,
            },
          },
        ],
        enabled: true,
        count: 42,
        nullValue: null,
      };

      // Save data to YAML file
      saveYamlFile(testFile, data);

      // Load the file and check its content
      const loadedData = loadYamlFile(testFile);
      expect(loadedData).toEqual(data);
    });
  });
});
