/**
 * Integration tests for Configuration Manager
 */

import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigurationManager } from '../../../src/config/manager.js';
import { TestFileSystem } from '../../helpers/fs-helper.js';

describe('ConfigurationManager integration tests', () => {
  const fs = new TestFileSystem();

  it('should load configuration from file', async () => {
    // Create a temporary directory
    const tempDir = fs.createTempDir();

    // Create a test configuration file
    const configContent = `
name: test-project
description: Test project for integration testing
playbooks:
  basic: playbooks/basic.yml
vars:
  http_port:
    type: int
    description: HTTP port
    default: 80
    required: false
    min: 1
    max: 65535
`;

    fs.createTestFile(tempDir, 'aship.yml', configContent);

    // Create playbook file
    fs.createTestStructure(tempDir, {
      playbooks: null,
      'playbooks/basic.yml': `
---
- hosts: all
  vars:
    http_port: 80
  tasks:
    - name: Test task
      debug:
        msg: "HTTP port is {{ http_port }}"
`,
    });

    // Initialize configuration manager
    const configFilePath = path.join(tempDir, 'aship.yml');
    const configManager = new ConfigurationManager(configFilePath);

    // Load configuration
    const config = await configManager.loadConfig();

    // Verify configuration
    expect(config).toBeDefined();
    expect(config.name).toBe('test-project');
    expect(config.description).toBe('Test project for integration testing');
    expect(config.playbooks).toBeDefined();

    // Check playbooks configuration (now simple string mapping)
    if (config.playbooks) {
      expect(config.playbooks.basic).toBe('playbooks/basic.yml');
    }

    // Check variables configuration
    if (config.vars) {
      expect(config.vars.http_port).toBeDefined();
      expect(config.vars.http_port.type).toBe('int');
      expect(config.vars.http_port.default).toBe(80);
      expect(config.vars.http_port.min).toBe(1);
      expect(config.vars.http_port.max).toBe(65535);
    }
  });

  it('should save configuration to file', async () => {
    // Create a temporary directory
    const tempDir = fs.createTempDir();

    // Initialize configuration manager
    const configFilePath = path.join(tempDir, 'aship.yml');
    const configManager = new ConfigurationManager(configFilePath);

    // Create configuration
    const config = {
      name: 'new-project',
      description: 'New test project',
      playbooks: {
        basic: 'playbooks/basic.yml',
        deploy: 'playbooks/deploy.yml',
      },
      vars: {
        app_name: {
          type: 'string' as const,
          description: 'Application name',
          default: 'new-project',
          required: true,
        },
        app_port: {
          type: 'int' as const,
          description: 'Application port',
          default: 8080,
          required: false,
          min: 1000,
          max: 9999,
        },
      },
    };

    // Save configuration
    await configManager.saveConfig(config);

    // Reload configuration
    const loadedConfig = await configManager.loadConfig();

    // Verify configuration
    expect(loadedConfig).toBeDefined();
    expect(loadedConfig.name).toBe('new-project');
    expect(loadedConfig.description).toBe('New test project');
    expect(loadedConfig.playbooks).toBeDefined();

    // Check playbooks configuration (now simple string mapping)
    if (loadedConfig.playbooks) {
      expect(loadedConfig.playbooks.basic).toBe('playbooks/basic.yml');
      expect(loadedConfig.playbooks.deploy).toBe('playbooks/deploy.yml');
    }

    // Check variables configuration
    if (loadedConfig.vars) {
      expect(loadedConfig.vars.app_name).toBeDefined();
      expect(loadedConfig.vars.app_name.type).toBe('string');
      expect(loadedConfig.vars.app_name.default).toBe('new-project');
      expect(loadedConfig.vars.app_name.required).toBe(true);

      expect(loadedConfig.vars.app_port).toBeDefined();
      expect(loadedConfig.vars.app_port.type).toBe('int');
      expect(loadedConfig.vars.app_port.default).toBe(8080);
      expect(loadedConfig.vars.app_port.min).toBe(1000);
      expect(loadedConfig.vars.app_port.max).toBe(9999);
    }
  });
});
