/**
 * Test directory initialization behavior for config name change (from global-dir to aship_dir)
 */

import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { DirectoryManager } from '../../../src/config/directory-manager.js';

describe('Directory Config Name Tests', () => {
  let tempDir: string;
  let rcPath: string;
  let originalEnv: string | undefined;
  let originalHome: string | undefined;
  
  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'aship-test-'));
    
    // Save original environment variables
    originalEnv = process.env.ASHIP_GLOBAL_DIR;
    originalHome = process.env.HOME;
    
    // Set environment variables, temporarily change home directory location
    process.env.HOME = tempDir;
    
    // RC file path
    rcPath = path.join(tempDir, '.ashiprc');
  });
  
  afterEach(async () => {
    // Restore environment variables
    if (originalEnv === undefined) {
      delete process.env.ASHIP_GLOBAL_DIR;
    } else {
      process.env.ASHIP_GLOBAL_DIR = originalEnv;
    }
    
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    
    // Clean up temporary directory
    try {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean temporary directory: ${tempDir}`, error);
    }
  });
  
  it('should create .ashiprc file with aship_dir configuration', async () => {
    // Create directory manager instance and initialize
    const manager = new DirectoryManager();
    await manager.initialize();
    
    // Note: initialize() doesn't automatically create .ashiprc file
    // Need to explicitly call createDefaultRcFile method
    const createdPath = await manager.createDefaultRcFile(tempDir, true);
    expect(createdPath).toBe(rcPath);
    
    // Verify .ashiprc file exists
    expect(fs.existsSync(rcPath)).toBe(true);
    
    // Read configuration file content
    const content = await fsPromises.readFile(rcPath, 'utf-8');
    
    // Display configuration file content (for debugging)
    console.log('.ashiprc file content:', content);
    
    // Verify configuration file behavior
    // Verify it uses aship_dir instead of global_dir
    expect(content).toContain('aship_dir');
    
    // Note: createDefaultRcFile method uses a template file,
    // which might contain the default ~/.aship path instead of our temporary directory
    // We only need to verify it uses the correct configuration key name
    
    // Ensure old key names are not used
    expect(content.includes('global-dir =')).toBe(false);
    expect(content.includes('aship-dir =')).toBe(false);
  });
  
  it('should create the correct directory structure', async () => {
    // Create directory manager instance and initialize
    const manager = new DirectoryManager();
    const globalDir = manager.getGlobalDir();
    await manager.initialize();
    
    // Verify all necessary directories have been created
    const expectedDirs = [
      globalDir,
      path.join(globalDir, 'logs'),
      path.join(globalDir, 'logs/ansible'),
      path.join(globalDir, 'temp'),
      path.join(globalDir, 'temp/inventories'),
      path.join(globalDir, 'temp/session'),
      path.join(globalDir, 'cache'),
      path.join(globalDir, 'config'),
      path.join(globalDir, 'state')
    ];
    
    for (const dir of expectedDirs) {
      expect(fs.existsSync(dir)).toBe(true);
    }
    
    // Verify hosts.json file creation
    const hostsFile = path.join(globalDir, 'hosts.json');
    expect(fs.existsSync(hostsFile)).toBe(true);
    
    // Check hosts.json content
    const hostsContent = await fsPromises.readFile(hostsFile, 'utf-8');
    const hostsData = JSON.parse(hostsContent);
    expect(hostsData).toHaveProperty('hosts');
    expect(Array.isArray(hostsData.hosts)).toBe(true);
  });
});
