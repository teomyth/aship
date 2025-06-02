import { vi } from 'vitest';

import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ProjectConfig } from '../../../src/types/index.js';
import { ConfigurationManager } from '../../../src/config/manager.js';

// Mock utilities
vi.mock('../../../src/utils/yaml.js', () => ({
  loadYamlFile: vi.fn(),
  saveYamlFile: vi.fn(),
}));

vi.mock('../../../src/utils/fs.js', () => ({
  fileExists: vi.fn(),
}));

// Import mocked modules
import * as yamlUtils from '../../../src/utils/yaml.js';
import * as fsUtils from '../../../src/utils/fs.js';

describe('ConfigurationManager', () => {
  const TEST_CONFIG_PATH = '/path/to/aship.yml';
  const TEST_PROJECT_DIR = '/path/to';

  // Sample valid configuration
  const sampleConfig: ProjectConfig = {
    name: 'test-project',
    description: 'Test project',
    playbooks: {
      setup: 'site.yml',
    },
    vars: {
      app_name: {
        type: 'string',
        description: 'Application name',
        default: 'test-app',
        required: true,
      },
      app_port: {
        type: 'int',
        description: 'Application port',
        default: 8080,
        required: false,
      },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('loadConfig', () => {
    it('should load configuration from file', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(true);
      (yamlUtils.loadYamlFile as any).mockReturnValue(sampleConfig);

      // Create instance and load config
      const manager = new ConfigurationManager(TEST_CONFIG_PATH);
      const config = await manager.loadConfig();

      // Verify
      expect(fsUtils.fileExists).toHaveBeenCalledWith(TEST_CONFIG_PATH);
      expect(yamlUtils.loadYamlFile).toHaveBeenCalledWith(TEST_CONFIG_PATH);
      expect(config).toEqual(sampleConfig);
      expect(manager.getConfig()).toEqual(sampleConfig);
    });

    it('should throw error if config file does not exist', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(false);

      // Create instance
      const manager = new ConfigurationManager(TEST_CONFIG_PATH);

      // Call and verify
      await expect(manager.loadConfig()).rejects.toThrow('Configuration file not found');
    });

    it('should throw error if loading fails', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(true);
      (yamlUtils.loadYamlFile as any).mockImplementation(() => {
        throw new Error('YAML parsing error');
      });

      // Create instance
      const manager = new ConfigurationManager(TEST_CONFIG_PATH);

      // Call and verify
      await expect(manager.loadConfig()).rejects.toThrow('Failed to load configuration file');
    });

    it('should return cached config if already loaded', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(true);
      (yamlUtils.loadYamlFile as any).mockReturnValue(sampleConfig);

      // Create instance and load config
      const manager = new ConfigurationManager(TEST_CONFIG_PATH);
      await manager.loadConfig();

      // Reset mocks to verify they aren't called again
      vi.resetAllMocks();

      // Load again
      const config = await manager.loadConfig();

      // Verify mocks were not called
      expect(fsUtils.fileExists).not.toHaveBeenCalled();
      expect(yamlUtils.loadYamlFile).not.toHaveBeenCalled();
      expect(config).toEqual(sampleConfig);
    });
  });

  describe('saveConfig', () => {
    it('should save configuration to file', async () => {
      // Create instance
      const manager = new ConfigurationManager(TEST_CONFIG_PATH);

      // Call save
      await manager.saveConfig(sampleConfig);

      // Verify
      expect(yamlUtils.saveYamlFile).toHaveBeenCalledWith(TEST_CONFIG_PATH, sampleConfig);
      expect(manager.getConfig()).toEqual(sampleConfig);
    });

    it('should throw error if saving fails', async () => {
      // Setup mocks
      (yamlUtils.saveYamlFile as any).mockImplementation(() => {
        throw new Error('Write error');
      });

      // Create instance
      const manager = new ConfigurationManager(TEST_CONFIG_PATH);

      // Call and verify
      await expect(manager.saveConfig(sampleConfig)).rejects.toThrow(
        'Failed to save configuration file'
      );
    });
  });

  describe('initializeProject', () => {
    it('should create new project configuration', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(false);

      // Call initialize
      const config = await ConfigurationManager.initializeProject(TEST_PROJECT_DIR);

      // Verify
      const expectedConfig = {
        name: path.basename(TEST_PROJECT_DIR),
        description: `Aship project: ${path.basename(TEST_PROJECT_DIR)}`,
        playbooks: {
          setup: 'site.yml',
        },
        // No vars section by default - users should add their own variables as needed
      };

      expect(fsUtils.fileExists).toHaveBeenCalledWith(path.join(TEST_PROJECT_DIR, 'aship.yml'));
      expect(yamlUtils.saveYamlFile).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_DIR, 'aship.yml'),
        expectedConfig
      );
      expect(config).toEqual(expectedConfig);
    });

    it('should throw error if project already initialized', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(true);

      // Call and verify
      await expect(ConfigurationManager.initializeProject(TEST_PROJECT_DIR)).rejects.toThrow(
        'Project already initialized'
      );
    });

    it('should create minimal configuration when minimal option is true', async () => {
      // Setup mocks
      (fsUtils.fileExists as any).mockReturnValue(false);

      // Call initialize with minimal option
      const config = await ConfigurationManager.initializeProject(TEST_PROJECT_DIR, { minimal: true });

      // Verify
      const expectedConfig = {
        name: path.basename(TEST_PROJECT_DIR),
      };

      expect(fsUtils.fileExists).toHaveBeenCalledWith(path.join(TEST_PROJECT_DIR, 'aship.yml'));
      expect(yamlUtils.saveYamlFile).toHaveBeenCalledWith(
        path.join(TEST_PROJECT_DIR, 'aship.yml'),
        expectedConfig
      );
      expect(config).toEqual(expectedConfig);
    });
  });

  describe('validateConfig', () => {
    it('should validate valid configuration', () => {
      const result = ConfigurationManager.validateConfig(sampleConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing project name', () => {
      const invalidConfig = { ...sampleConfig, name: '' };

      const result = ConfigurationManager.validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(error => error.includes('name'))).toBe(true);
    });

    it('should detect invalid variable type', () => {
      const invalidConfig = {
        ...sampleConfig,
        vars: {
          invalid_var: {
            type: 'invalid-type' as any,
            description: 'Invalid variable',
          },
        },
      };

      const result = ConfigurationManager.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should detect unknown properties', () => {
      const invalidConfig = {
        ...sampleConfig,
        unknownProperty: 'should not be allowed',
      };

      const result = ConfigurationManager.validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate playbooks with simple format', () => {
      const configWithPlaybooks = {
        ...sampleConfig,
        playbooks: {
          setup: 'site.yml',
          deploy: 'playbooks/deploy.yml',
        },
      };

      const result = ConfigurationManager.validateConfig(configWithPlaybooks);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect invalid playbook path type', () => {
      const invalidConfig = {
        ...sampleConfig,
        playbooks: {
          test: 123, // Should be string
        },
      };

      const result = ConfigurationManager.validateConfig(invalidConfig as any);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('validateVariableValue', () => {
    it('should validate string values', () => {
      const variable = {
        type: 'string' as const,
        description: 'Test string',
        required: false,
      };

      expect(ConfigurationManager.validateVariableValue(variable, 'test')).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 123)).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, true)).toBe(false);
    });

    it('should validate int values', () => {
      const variable = {
        type: 'int' as const,
        description: 'Test int',
        required: false,
      };

      expect(ConfigurationManager.validateVariableValue(variable, 123)).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 'test')).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, true)).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, 3.14)).toBe(false); // Not integer
    });

    it('should validate bool values', () => {
      const variable = {
        type: 'bool' as const,
        description: 'Test bool',
        required: false,
      };

      expect(ConfigurationManager.validateVariableValue(variable, true)).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, false)).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 'test')).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, 123)).toBe(false);
    });

    it('should validate list values', () => {
      const variable = {
        type: 'list' as const,
        description: 'Test list',
        required: false,
      };

      expect(ConfigurationManager.validateVariableValue(variable, [])).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, ['test'])).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 'test')).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, 123)).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, {})).toBe(false);
    });

    // Note: dict type has been removed from aship - complex objects should be handled as multiple individual variables

    it('should validate choice values', () => {
      const variable = {
        type: 'choice' as const,
        description: 'Test choice',
        required: false,
        choices: ['option1', 'option2', 'option3'],
      };

      expect(ConfigurationManager.validateVariableValue(variable, 'option1')).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 'option2')).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 'invalid')).toBe(false);
    });

    it('should validate password values', () => {
      const variable = {
        type: 'password' as const,
        description: 'Test password',
        required: false,
      };

      expect(ConfigurationManager.validateVariableValue(variable, 'secret123')).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, '')).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, 123)).toBe(false);
    });

    it('should validate required values', () => {
      const variable = {
        type: 'string' as const,
        description: 'Test string',
        required: true,
      };

      expect(ConfigurationManager.validateVariableValue(variable, 'test')).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, undefined)).toBe(false);
    });

    it('should validate pattern', () => {
      const variable = {
        type: 'string' as const,
        description: 'Test string',
        required: false,
        pattern: '^[a-z]+$',
      };

      expect(ConfigurationManager.validateVariableValue(variable, 'test')).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 'TEST')).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, '123')).toBe(false);
    });

    it('should validate min/max for integers', () => {
      const variable = {
        type: 'int' as const,
        description: 'Test int',
        required: false,
        min: 10,
        max: 100,
      };

      expect(ConfigurationManager.validateVariableValue(variable, 50)).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 10)).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 100)).toBe(true);
      expect(ConfigurationManager.validateVariableValue(variable, 9)).toBe(false);
      expect(ConfigurationManager.validateVariableValue(variable, 101)).toBe(false);
    });

    it('should skip validation for undefined values when not required', () => {
      const variable = {
        type: 'string' as const,
        description: 'Test string',
        required: false,
      };

      expect(ConfigurationManager.validateVariableValue(variable, undefined)).toBe(true);
    });
  });
});
