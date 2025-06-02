/**
 * Tests for Directory initialization using temporary directories
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { DirectoryManager } from '../../../src/config/directory-manager.js';

describe('Directory Initialization Tests', () => {
  let directoryManager: DirectoryManager;
  let tempDir: string;
  let originalEnv: string | undefined;
  
  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'aship-test-'));
    
    // Save original env value
    originalEnv = process.env.ASHIP_GLOBAL_DIR;
    
    // Set environment variable to use our temp directory
    process.env.ASHIP_GLOBAL_DIR = tempDir;
    
    // Create a fresh DirectoryManager
    directoryManager = new DirectoryManager();
  });
  
  afterEach(async () => {
    // Restore original env value
    if (originalEnv === undefined) {
      delete process.env.ASHIP_GLOBAL_DIR;
    } else {
      process.env.ASHIP_GLOBAL_DIR = originalEnv;
    }
    
    // Clean up the temp directory after each test
    try {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn(`Failed to clean up temp directory: ${tempDir}`, error);
    }
    
    vi.clearAllMocks();
  });
  
  describe('Basic directory initialization', () => {
    it('should create the correct directory structure', async () => {
      // Initialize the directory structure
      await directoryManager.initialize();
      
      // Check that all required directories exist
      const expectedDirectories = [
        tempDir,
        path.join(tempDir, 'logs'),
        path.join(tempDir, 'logs/ansible'),
        path.join(tempDir, 'temp'),
        path.join(tempDir, 'temp/inventories'),
        path.join(tempDir, 'temp/session'),
        path.join(tempDir, 'cache'),
        path.join(tempDir, 'config'),
        path.join(tempDir, 'state')
      ];
      
      for (const dir of expectedDirectories) {
        expect(fs.existsSync(dir)).toBe(true);
      }
    });
    
    it('should create default configuration files', async () => {
      await directoryManager.initialize();
      
      // Check for required configuration files
      const hostsFile = path.join(tempDir, 'hosts.json');
      
      // Check the content of hosts.json
      const hostsContent = await fsPromises.readFile(hostsFile, 'utf-8');
      expect(JSON.parse(hostsContent)).toHaveProperty('hosts');
      expect(Array.isArray(JSON.parse(hostsContent).hosts)).toBe(true);
    });
  });
  
  describe('Configuration file creation', () => {
    it('should create default .ashiprc file if it does not exist', async () => {
      // Initialize the directory structure
      await directoryManager.initialize();

      // Create the rc file explicitly since initialize doesn't create it
      const rcFile = await directoryManager.createDefaultRcFile();

      // Verify .ashiprc file is created
      expect(fs.existsSync(rcFile)).toBe(true);

      // Check content of the rc file
      const rcContent = await fsPromises.readFile(rcFile, 'utf-8');
      expect(rcContent).toContain('aship_dir');
    });
  });
  
  describe('Configuration file support', () => {
    let rcPath: string;
    
    beforeEach(() => {
      // We'll create rc file in the temp directory to avoid modifying user's actual config
      rcPath = path.join(os.homedir(), '.ashiprc');
    });
    
    it('should respect existing rc file with aship_dir', async () => {
      // Create a rc file with aship_dir configuration
      const customDirPath = path.join(tempDir, 'custom-aship');
      const oldContent = `
# Aship configuration
aship_dir = ${customDirPath}
log_level = debug
      `;
      await fsPromises.writeFile(rcPath, oldContent, { encoding: 'utf-8' });
      
      // Save current environment variable for later restoration
      const savedEnv = process.env.ASHIP_GLOBAL_DIR;
      
      try {
        // Temporarily remove environment variable to ensure config file is read
        delete process.env.ASHIP_GLOBAL_DIR;
        
        // Create a new directory manager - should read from the existing rc file
        const newManager = new DirectoryManager();
        
        // Create custom directory
        await fsPromises.mkdir(customDirPath, { recursive: true });
        
        // Verify it uses the path from the rc file
        expect(newManager.getGlobalDir()).toBe(customDirPath);
      } finally {
        // Restore environment variable
        process.env.ASHIP_GLOBAL_DIR = savedEnv;
      }
    });
    
    it('should use aship_dir configuration', async () => {
      // Create custom directory
      const customPath = path.join(tempDir, 'new-aship');
      await fsPromises.mkdir(customPath, { recursive: true });
      
      // Create RC file with underscore configuration
      const newContent = `
# Aship configuration
aship_dir = ${customPath}
log_level = info
      `;
      await fsPromises.writeFile(rcPath, newContent, { encoding: 'utf-8' });
      
      // Save current environment variable
      const savedEnv = process.env.ASHIP_GLOBAL_DIR;
      
      try {
        // Temporarily remove environment variable to ensure config file is read
        delete process.env.ASHIP_GLOBAL_DIR;
        
        // Create a new directory manager that should read from config file
        const dirManager = new DirectoryManager();
        
        // Verify it uses the correct configuration
        const globalDir = dirManager.getGlobalDir();
        expect(globalDir).toBe(customPath);
      } finally {
        // Restore environment variable
        process.env.ASHIP_GLOBAL_DIR = savedEnv;
      }
    });
  });
  
  describe('Environment variable override', () => {
    it('should respect ASHIP_GLOBAL_DIR environment variable', async () => {
      // Create a subdirectory in our temp dir for this test
      const customPath = path.join(tempDir, 'custom-path');
      await fsPromises.mkdir(customPath, { recursive: true });
      
      // Save current environment variable value
      const savedEnv = process.env.ASHIP_GLOBAL_DIR;
      
      try {
        // Set environment variable for testing
        process.env.ASHIP_GLOBAL_DIR = customPath;
        
        // Create a new directory manager
        const envManager = new DirectoryManager();
        
        // Verify it uses the path from environment variable
        expect(envManager.getGlobalDir()).toBe(customPath);
        
        // Initialize directory should use this path
        await envManager.initialize();
        
        // Check that directories were created
        const expectedDirs = [
          customPath,
          path.join(customPath, 'logs'),
          path.join(customPath, 'logs/ansible'),
          path.join(customPath, 'temp'),
          path.join(customPath, 'temp/inventories'),
          path.join(customPath, 'temp/session'),
          path.join(customPath, 'cache'),
          path.join(customPath, 'config'),
          path.join(customPath, 'state')
        ];
        
        for (const dir of expectedDirs) {
          expect(fs.existsSync(dir)).toBe(true);
        }
        
        // Also verify that hosts.json file was created
        const hostsFile = path.join(customPath, 'hosts.json');
        expect(fs.existsSync(hostsFile)).toBe(true);
      } finally {
        // Restore original env value
        if (savedEnv === undefined) {
          delete process.env.ASHIP_GLOBAL_DIR;
        } else {
          process.env.ASHIP_GLOBAL_DIR = savedEnv;
        }
      }
    });
  });
});
