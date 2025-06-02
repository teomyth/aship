/**
 * Unit tests for network connectivity functions
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { testNetworkConnectivity, diagnoseConnection } from '../../../src/utils/ssh.js';
import type { ServerConfig } from '../../../src/types/index.js';

// Mock the net module
vi.mock('net', () => {
  return {
    Socket: vi.fn().mockImplementation(() => {
      return {
        setTimeout: vi.fn(),
        on: vi.fn(),
        connect: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      };
    }),
  };
});

// Mock the testConnection function
vi.mock('../../../src/utils/ssh.js', async (importOriginal) => {
  const originalModule = await importOriginal();
  return {
    ...originalModule,
    testConnection: vi.fn(),
    testSSHPortConnectivity: vi.fn(),
  };
});

describe('Network connectivity tests', () => {
  let mockSocket: any;
  let mockConnect: any;
  let mockOn: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Get the mock socket instance
    mockSocket = require('net').Socket();
    mockConnect = mockSocket.connect;
    mockOn = mockSocket.on;
    
    // Setup the mock behavior
    let connectHandler: Function;
    let timeoutHandler: Function;
    let errorHandler: Function;
    
    mockOn.mockImplementation((event: string, callback: Function) => {
      if (event === 'connect') {
        connectHandler = callback;
      } else if (event === 'timeout') {
        timeoutHandler = callback;
      } else if (event === 'error') {
        errorHandler = callback;
      }
    });
    
    mockConnect.mockImplementation((_port: number, host: string) => {
      // Simulate different behaviors based on the host
      if (host === 'reachable-host.com') {
        setTimeout(() => connectHandler(), 10);
      } else if (host === 'timeout-host.com') {
        setTimeout(() => timeoutHandler(), 10);
      } else if (host === 'error-host.com') {
        setTimeout(() => errorHandler(new Error('Connection refused')), 10);
      }
    });
  });
  
  it('should return success for a reachable host', async () => {
    const result = await testNetworkConnectivity('reachable-host.com');
    
    expect(result.success).toBe(true);
    expect(result.message).toBe('Host is reachable');
    expect(mockConnect).toHaveBeenCalledWith(7, 'reachable-host.com');
  });
  
  it('should return failure for a host that times out', async () => {
    const result = await testNetworkConnectivity('timeout-host.com');
    
    expect(result.success).toBe(false);
    expect(result.message).toBe('Connection timed out');
    expect(mockConnect).toHaveBeenCalledWith(7, 'timeout-host.com');
  });
  
  it('should return failure with error message for a host that returns an error', async () => {
    const result = await testNetworkConnectivity('error-host.com');
    
    expect(result.success).toBe(false);
    expect(result.message).toBe('Connection refused');
    expect(mockConnect).toHaveBeenCalledWith(7, 'error-host.com');
  });
});

describe('Connection diagnostics tests', () => {
  // Import the mocked functions
  const { testConnection, testSSHPortConnectivity } = require('../../../src/utils/ssh.js');
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });
  
  it('should identify network connectivity issues', async () => {
    // Mock testNetworkConnectivity to return failure
    vi.spyOn(global, 'testNetworkConnectivity').mockResolvedValueOnce({
      success: false,
      message: 'Connection timed out',
    });
    
    // Create a server config
    const server: ServerConfig = {
      name: 'test-server',
      host: 'unreachable-host.com',
      port: 22,
      user: 'testuser',
      auth: {
        type: 'key',
        value: '/path/to/key',
      },
    };
    
    // Call diagnoseConnection
    const result = await diagnoseConnection(server);
    
    // Verify the result
    expect(result.overallSuccess).toBe(false);
    expect(result.primaryIssue).toBe('network');
    expect(result.detailedMessage).toContain('Cannot reach host');
    
    // Verify testSSHPortConnectivity and testConnection were not called
    expect(testSSHPortConnectivity).not.toHaveBeenCalled();
    expect(testConnection).not.toHaveBeenCalled();
  });
  
  it('should identify SSH port connectivity issues', async () => {
    // Mock testNetworkConnectivity to return success
    vi.spyOn(global, 'testNetworkConnectivity').mockResolvedValueOnce({
      success: true,
      message: 'Host is reachable',
    });
    
    // Mock testSSHPortConnectivity to return failure
    testSSHPortConnectivity.mockResolvedValueOnce({
      success: false,
      message: 'SSH port 22 is closed or blocked',
    });
    
    // Create a server config
    const server: ServerConfig = {
      name: 'test-server',
      host: 'host-without-ssh.com',
      port: 22,
      user: 'testuser',
      auth: {
        type: 'key',
        value: '/path/to/key',
      },
    };
    
    // Call diagnoseConnection
    const result = await diagnoseConnection(server);
    
    // Verify the result
    expect(result.overallSuccess).toBe(false);
    expect(result.primaryIssue).toBe('port');
    expect(result.detailedMessage).toContain('Connection refused');
    
    // Verify testSSHPortConnectivity was called but testConnection was not
    expect(testSSHPortConnectivity).toHaveBeenCalledWith('host-without-ssh.com', 22);
    expect(testConnection).not.toHaveBeenCalled();
  });
  
  it('should identify authentication issues', async () => {
    // Mock testNetworkConnectivity to return success
    vi.spyOn(global, 'testNetworkConnectivity').mockResolvedValueOnce({
      success: true,
      message: 'Host is reachable',
    });
    
    // Mock testSSHPortConnectivity to return success
    testSSHPortConnectivity.mockResolvedValueOnce({
      success: true,
      message: 'SSH port 22 is open',
    });
    
    // Mock testConnection to return authentication failure
    testConnection.mockResolvedValueOnce({
      success: false,
      message: 'Authentication failed',
    });
    
    // Create a server config
    const server: ServerConfig = {
      name: 'test-server',
      host: 'host-with-auth-issues.com',
      port: 22,
      user: 'testuser',
      auth: {
        type: 'key',
        value: '/path/to/key',
      },
    };
    
    // Call diagnoseConnection
    const result = await diagnoseConnection(server);
    
    // Verify the result
    expect(result.overallSuccess).toBe(false);
    expect(result.primaryIssue).toBe('authentication');
    expect(result.detailedMessage).toContain('Authentication failed');
    
    // Verify all functions were called
    expect(testSSHPortConnectivity).toHaveBeenCalledWith('host-with-auth-issues.com', 22);
    expect(testConnection).toHaveBeenCalledWith(server);
  });
  
  it('should handle successful connections', async () => {
    // Mock testNetworkConnectivity to return success
    vi.spyOn(global, 'testNetworkConnectivity').mockResolvedValueOnce({
      success: true,
      message: 'Host is reachable',
    });
    
    // Mock testSSHPortConnectivity to return success
    testSSHPortConnectivity.mockResolvedValueOnce({
      success: true,
      message: 'SSH port 22 is open',
    });
    
    // Mock testConnection to return success
    testConnection.mockResolvedValueOnce({
      success: true,
      message: 'Connection successful',
      method: 'key',
      user: 'testuser',
      keyPath: '/path/to/key',
    });
    
    // Create a server config
    const server: ServerConfig = {
      name: 'test-server',
      host: 'reachable-host.com',
      port: 22,
      user: 'testuser',
      auth: {
        type: 'key',
        value: '/path/to/key',
      },
    };
    
    // Call diagnoseConnection
    const result = await diagnoseConnection(server);
    
    // Verify the result
    expect(result.overallSuccess).toBe(true);
    expect(result.primaryIssue).toBe('none');
    expect(result.detailedMessage).toBe('Connection successful!');
    
    // Verify all functions were called
    expect(testSSHPortConnectivity).toHaveBeenCalledWith('reachable-host.com', 22);
    expect(testConnection).toHaveBeenCalledWith(server);
  });
});
