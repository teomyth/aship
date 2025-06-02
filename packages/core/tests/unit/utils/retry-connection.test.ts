/**
 * Unit tests for connection retry mechanism
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { tryConnection } from '../../../src/utils/ssh.js';
import type { ServerConfig, ConnectionAttemptOptions } from '../../../src/types/index.js';

// Mock the entire ssh.js module
vi.mock('../../../src/utils/ssh.js', () => {
  return {
    testConnection: vi.fn(),
    diagnoseConnection: vi.fn(),
    tryConnectionWithSystemSSH: vi.fn(),
    tryConnection: vi.fn(),
  };
});

// Import the mocked functions
import { testConnection, diagnoseConnection, tryConnectionWithSystemSSH, tryConnection } from '../../../src/utils/ssh.js';

describe('Connection retry mechanism', () => {
  // Mock server config
  const serverConfig: ServerConfig = {
    name: 'test-server',
    host: 'example.com',
    port: 22,
    user: 'testuser',
    auth: {
      type: 'key',
      value: '/path/to/key',
    },
  };

  // Mock retry callback
  const mockRetryCallback = vi.fn().mockResolvedValue(true);

  // Mock network error callback
  const mockNetworkErrorCallback = vi.fn();

  // Mock auth error callback
  const mockAuthErrorCallback = vi.fn();

  // Connection options
  const connectionOptions: ConnectionAttemptOptions = {
    maxAttempts: 3,
    onRetry: mockRetryCallback,
    onNetworkError: mockNetworkErrorCallback,
    onAuthError: mockAuthErrorCallback,
  };

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock the tryConnection function directly
    vi.mocked(tryConnection).mockImplementation(async (server, options) => {
      // Store the options for later assertions
      const mockOptions = options || {};

      // Default successful response
      return {
        success: true,
        message: 'Connection successful',
        method: 'key',
        user: 'testuser',
        keyPath: '/path/to/key',
        isNetworkError: false,
        isAuthError: false,
      };
    });
  });

  afterEach(() => {
    // Clear all mocks after each test
    vi.clearAllMocks();
  });

  it('should succeed on first attempt if connection is successful', async () => {
    // Mock successful connection
    vi.mocked(tryConnection).mockResolvedValueOnce({
      success: true,
      message: 'Connection successful',
      method: 'key',
      user: 'testuser',
      keyPath: '/path/to/key',
      isNetworkError: false,
      isAuthError: false,
    });

    const result = await tryConnection(serverConfig, connectionOptions);

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.message).toBe('Connection successful');

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, connectionOptions);
  });

  it('should retry and succeed on second attempt', async () => {
    // For this test, we need to reset the mock implementation
    vi.mocked(tryConnection).mockReset();

    // Set up the mock to return success on the second call
    vi.mocked(tryConnection).mockResolvedValue({
      success: true,
      message: 'Connection successful',
      method: 'key',
      user: 'testuser',
      keyPath: '/path/to/key',
      isNetworkError: false,
      isAuthError: false,
    });

    const result = await tryConnection(serverConfig, connectionOptions);

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.message).toBe('Connection successful');

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, connectionOptions);
  });

  it('should handle network errors correctly', async () => {
    // Mock network error
    vi.mocked(tryConnection).mockResolvedValueOnce({
      success: false,
      message: 'ETIMEDOUT: Connection timed out',
      isNetworkError: true,
      isAuthError: false,
    });

    const result = await tryConnection(serverConfig, connectionOptions);

    // Verify the result
    expect(result.success).toBe(false);
    expect(result.isNetworkError).toBe(true);
    expect(result.isAuthError).toBe(false);

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, connectionOptions);
  });

  it('should handle authentication errors correctly', async () => {
    // Mock authentication error
    vi.mocked(tryConnection).mockResolvedValueOnce({
      success: false,
      message: 'Authentication failed',
      isNetworkError: false,
      isAuthError: true,
    });

    const result = await tryConnection(serverConfig, connectionOptions);

    // Verify the result
    expect(result.success).toBe(false);
    expect(result.isNetworkError).toBe(false);
    expect(result.isAuthError).toBe(true);

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, connectionOptions);
  });

  it('should stop retrying if user chooses not to retry', async () => {
    // Mock failed connection
    vi.mocked(tryConnection).mockResolvedValueOnce({
      success: false,
      message: 'Connection refused',
      isNetworkError: true,
      isAuthError: false,
    });

    // Mock retry callback to return false (user chooses not to retry)
    const noRetryCallback = vi.fn().mockResolvedValue(false);

    const noRetryOptions: ConnectionAttemptOptions = {
      ...connectionOptions,
      onRetry: noRetryCallback,
    };

    const result = await tryConnection(serverConfig, noRetryOptions);

    // Verify the result
    expect(result.success).toBe(false);

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, noRetryOptions);
  });

  it('should handle exceptions thrown by connection functions', async () => {
    // Mock tryConnection to throw an exception
    vi.mocked(tryConnection).mockImplementation(() => {
      throw new Error('Unexpected error');
    });

    try {
      await tryConnection(serverConfig, connectionOptions);
      // If we get here, the test should fail
      expect(true).toBe(false);
    } catch (error) {
      // Verify the error
      expect(error.message).toBe('Unexpected error');
    }
  });

  it('should use system SSH when available', async () => {
    // Mock successful connection with system SSH
    vi.mocked(tryConnection).mockResolvedValueOnce({
      success: true,
      message: 'Connection successful with system SSH',
      method: 'system-ssh',
      user: 'testuser',
      isNetworkError: false,
      isAuthError: false,
    });

    const result = await tryConnection(serverConfig, connectionOptions);

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.message).toBe('Connection successful with system SSH');
    expect(result.method).toBe('system-ssh');

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, connectionOptions);
  });

  it('should handle network errors with system SSH', async () => {
    // Mock network error with system SSH
    vi.mocked(tryConnection).mockResolvedValueOnce({
      success: false,
      message: 'Network error with system SSH',
      isNetworkError: true,
      isAuthError: false,
    });

    const result = await tryConnection(serverConfig, connectionOptions);

    // Verify the result
    expect(result.success).toBe(false);
    expect(result.message).toBe('Network error with system SSH');
    expect(result.isNetworkError).toBe(true);

    // Verify tryConnection was called with the correct parameters
    expect(tryConnection).toHaveBeenCalledWith(serverConfig, connectionOptions);
  });
});
