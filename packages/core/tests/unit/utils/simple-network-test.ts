/**
 * Simple test for network connectivity functions
 */

import { describe, expect, it, vi } from 'vitest';
import { diagnoseConnection } from '../../../src/utils/ssh.js';
import type { ServerConfig } from '../../../src/types/index.js';

// Mock the testNetworkConnectivity function
vi.mock('../../../src/utils/ssh.js', async (importOriginal) => {
  const originalModule = await importOriginal();
  return {
    ...originalModule,
    testNetworkConnectivity: vi.fn(),
    testSSHPortConnectivity: vi.fn(),
    testConnection: vi.fn(),
  };
});

describe('Connection diagnostics flow', () => {
  // Import the mocked functions
  const { testNetworkConnectivity, testSSHPortConnectivity, testConnection } = vi.mocked(require('../../../src/utils/ssh.js'));
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
  });
  
  it('should identify network connectivity issues first', async () => {
    // Mock testNetworkConnectivity to return failure
    testNetworkConnectivity.mockResolvedValueOnce({
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
  
  it('should proceed to SSH port check if network is reachable', async () => {
    // Mock testNetworkConnectivity to return success
    testNetworkConnectivity.mockResolvedValueOnce({
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
    
    // Verify testNetworkConnectivity was called
    expect(testNetworkConnectivity).toHaveBeenCalledWith('host-without-ssh.com');
    
    // Verify testSSHPortConnectivity was called but testConnection was not
    expect(testSSHPortConnectivity).toHaveBeenCalledWith('host-without-ssh.com', 22);
    expect(testConnection).not.toHaveBeenCalled();
  });
  
  it('should proceed to authentication check if SSH port is open', async () => {
    // Mock testNetworkConnectivity to return success
    testNetworkConnectivity.mockResolvedValueOnce({
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
    expect(testNetworkConnectivity).toHaveBeenCalledWith('host-with-auth-issues.com');
    expect(testSSHPortConnectivity).toHaveBeenCalledWith('host-with-auth-issues.com', 22);
    expect(testConnection).toHaveBeenCalledWith(server);
  });
});
