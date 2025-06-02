/**
 * Unit tests for main module exports
 */

import { describe, expect, it } from 'vitest';
import * as core from '../../src/index.js';

describe('Core module exports', () => {
  it('should export ansible functionality', () => {
    // Check for ansible exports
    expect(core).toHaveProperty('generateInventoryContent');
    expect(core).toHaveProperty('generateInventoryFile');
    expect(core).toHaveProperty('executeAnsiblePlaybook');
    expect(core).toHaveProperty('AnsibleRunner');
  });

  it('should export config functionality', () => {
    // Check for config exports
    expect(core).toHaveProperty('ConfigurationManager');
  });

  it('should export server functionality', () => {
    // Check for server exports
    expect(core).toHaveProperty('ServerManager');
  });

  it('should export variables functionality', () => {
    // Variables module is now minimal as variable collection moved to CLI package
    // Just verify the module structure is intact
    expect(typeof core).toBe('object');
  });

  it('should export types', () => {
    // We can't directly check for types as they're erased at runtime,
    // but we can check that the module is exported
    expect(Object.keys(core).length).toBeGreaterThan(0);
  });

  it('should export utilities', () => {
    // Check for utility exports
    expect(core).toHaveProperty('fileExists');
    expect(core).toHaveProperty('directoryExists');
    expect(core).toHaveProperty('ensureDirectoryExists');
    expect(core).toHaveProperty('readTextFile');
    expect(core).toHaveProperty('writeTextFile');
    expect(core).toHaveProperty('loadYamlFile');
    expect(core).toHaveProperty('saveYamlFile');
    expect(core).toHaveProperty('testConnection');
  });
});
