/**
 * Tests for file resolver utility
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveFilePath, type FileTypeConfig } from '../../../src/utils/file-resolver.js';
import * as fs from '../../../src/utils/fs.js';

// Mock fileExists
vi.mock('../../../src/utils/fs.js', () => ({
  fileExists: vi.fn(),
}));

describe('File resolver', () => {
  const mockLogger = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  };

  const mockPrompt = vi.fn();

  const testConfig: FileTypeConfig = {
    extensions: ['.yml', '.yaml'],
    defaultFileName: 'test',
    defaultDirName: 'tests',
    description: 'Test file',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    // Default behavior: file doesn't exist
    vi.mocked(fs.fileExists).mockReturnValue(false);
  });

  it('should resolve absolute path if file exists', async () => {
    const absolutePath = '/absolute/path/to/file.yml';
    vi.mocked(fs.fileExists).mockImplementation((path) => path === absolutePath);

    const result = await resolveFilePath(absolutePath, '/current/dir', testConfig, {
      nonInteractive: true,
      logger: mockLogger,
    });

    expect(result).toBe(absolutePath);
    expect(fs.fileExists).toHaveBeenCalledWith(absolutePath);
  });

  it('should resolve relative path if file exists', async () => {
    const relativePath = 'relative/path/to/file.yml';
    const absolutePath = '/current/dir/relative/path/to/file.yml';
    vi.mocked(fs.fileExists).mockImplementation((path) => path === absolutePath);

    const result = await resolveFilePath(relativePath, '/current/dir', testConfig, {
      nonInteractive: true,
      logger: mockLogger,
    });

    expect(result).toBe(absolutePath);
    expect(fs.fileExists).toHaveBeenCalledWith(absolutePath);
  });

  it('should add extension if file exists with extension', async () => {
    const filePath = 'file';
    const filePathWithExt = '/current/dir/file.yml';
    vi.mocked(fs.fileExists).mockImplementation((path) => path === filePathWithExt);

    const result = await resolveFilePath(filePath, '/current/dir', testConfig, {
      nonInteractive: true,
      logger: mockLogger,
    });

    expect(result).toBe(filePathWithExt);
  });

  it('should check in default directory if file exists there', async () => {
    const filePath = 'file.yml';
    const filePathInDefaultDir = '/current/dir/tests/file.yml';
    vi.mocked(fs.fileExists).mockImplementation((path) => path === filePathInDefaultDir);

    const result = await resolveFilePath(filePath, '/current/dir', testConfig, {
      nonInteractive: true,
      logger: mockLogger,
    });

    expect(result).toBe(filePathInDefaultDir);
  });

  it('should return undefined and log error in non-interactive mode if file not found', async () => {
    const result = await resolveFilePath('nonexistent.yml', '/current/dir', testConfig, {
      nonInteractive: true,
      logger: mockLogger,
    });

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('should prompt for new path in interactive mode if file not found', async () => {
    const newPath = '/new/path/file.yml';
    vi.mocked(fs.fileExists).mockImplementation((path) => path === newPath);
    mockPrompt.mockResolvedValueOnce({ filePath: newPath });

    const result = await resolveFilePath('nonexistent.yml', '/current/dir', testConfig, {
      nonInteractive: false,
      logger: mockLogger,
      promptFunction: mockPrompt,
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(result).toBe(newPath);
  });

  it('should check for default file if no path provided', async () => {
    const defaultFile = '/current/dir/test.yml';
    vi.mocked(fs.fileExists).mockImplementation((path) => path === defaultFile);

    const result = await resolveFilePath(undefined, '/current/dir', testConfig, {
      nonInteractive: true,
      logger: mockLogger,
    });

    expect(result).toBe(defaultFile);
    expect(fs.fileExists).toHaveBeenCalledWith(defaultFile);
  });

  it('should throw error if promptFunction not provided in interactive mode', async () => {
    await expect(
      resolveFilePath('nonexistent.yml', '/current/dir', testConfig, {
        nonInteractive: false,
        logger: mockLogger,
      })
    ).rejects.toThrow('promptFunction is required for interactive mode');
  });
});
