/**
 * Configuration manager for loading and saving project configurations
 */

import * as path from 'node:path';
import {
  type ProjectConfig,
  type VariableDefinition,
  createDefaultProjectConfig,
  createMinimalProjectConfig,
  validateProjectConfig,
  validateVariableValue,
} from '../schemas/index.js';
import { fileExists } from '../utils/fs.js';
import { loadYamlFile, saveYamlFile } from '../utils/yaml.js';

// Default configuration is now handled by schema functions

/**
 * Configuration manager class
 */
class ConfigurationManager {
  /**
   * Path to the configuration file
   */
  private configPath: string;

  /**
   * Loaded configuration
   */
  private config: ProjectConfig | null = null;

  /**
   * Constructor
   * @param configPath Path to the configuration file
   */
  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * Load the configuration file
   * @returns Loaded configuration
   */
  async loadConfig(): Promise<ProjectConfig> {
    if (this.config) {
      return this.config;
    }

    if (!fileExists(this.configPath)) {
      throw new Error(`Configuration file not found: ${this.configPath}`);
    }

    try {
      const rawConfig = loadYamlFile(this.configPath);
      if (!rawConfig) {
        throw new Error('Configuration file is empty or invalid');
      }

      // Validate configuration using Zod schema
      const validation = validateProjectConfig(rawConfig);
      if (!validation.success) {
        throw new Error(`Configuration validation failed:\n${validation.errors?.join('\n')}`);
      }

      this.config = validation.data as ProjectConfig;
      return this.config;
    } catch (error) {
      throw new Error(`Failed to load configuration file: ${(error as Error).message}`);
    }
  }

  /**
   * Save the configuration file
   * @param config Configuration to save
   */
  async saveConfig(config: ProjectConfig): Promise<void> {
    try {
      // Validate configuration before saving
      const validation = validateProjectConfig(config);
      if (!validation.success) {
        throw new Error(`Configuration validation failed:\n${validation.errors?.join('\n')}`);
      }

      saveYamlFile(this.configPath, validation.data as ProjectConfig);
      this.config = validation.data as ProjectConfig;
    } catch (error) {
      throw new Error(`Failed to save configuration file: ${(error as Error).message}`);
    }
  }

  /**
   * Get the current configuration
   * @returns Current configuration
   */
  getConfig(): ProjectConfig | null {
    return this.config;
  }

  /**
   * Initialize a new project
   * @param projectDir Project directory
   * @param options Initialization options
   * @returns Created configuration
   */
  static async initializeProject(
    projectDir: string,
    options?: { minimal?: boolean }
  ): Promise<ProjectConfig> {
    const configPath = path.join(projectDir, 'aship.yml');

    if (fileExists(configPath)) {
      throw new Error(`Project already initialized: ${configPath}`);
    }

    const projectName = path.basename(projectDir);
    const config = options?.minimal
      ? createMinimalProjectConfig(projectName)
      : createDefaultProjectConfig(projectName);

    saveYamlFile(configPath, config);

    return config;
  }

  /**
   * Create a new project with custom configuration
   * @param projectDir Project directory
   * @param config Custom configuration
   * @returns Created configuration
   */
  static async createProject(projectDir: string, config: any): Promise<ProjectConfig> {
    const configPath = path.join(projectDir, 'aship.yml');

    if (fileExists(configPath)) {
      throw new Error(`Project already initialized: ${configPath}`);
    }

    // Validate the configuration
    const validation = validateProjectConfig(config);
    if (!validation.success) {
      throw new Error(`Configuration validation failed:\n${validation.errors?.join('\n')}`);
    }

    const validatedConfig = validation.data as ProjectConfig;
    saveYamlFile(configPath, validatedConfig);

    return validatedConfig;
  }

  /**
   * Validate a configuration
   * @param config Configuration to validate
   * @returns Validation result
   */
  static validateConfig(config: unknown): {
    valid: boolean;
    errors: string[];
  } {
    const validation = validateProjectConfig(config);
    return {
      valid: validation.success,
      errors: validation.errors || [],
    };
  }

  /**
   * Validate a variable value against its definition
   * @param variable Variable definition
   * @param value Value to validate
   * @returns Whether the value is valid
   */
  static validateVariableValue(variable: VariableDefinition, value: any): boolean {
    const result = validateVariableValue(variable, value);
    return result.success;
  }
}

export { ConfigurationManager };
