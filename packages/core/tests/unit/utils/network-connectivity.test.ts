/**
 * Unit tests for network connectivity functions
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { testNetworkConnectivity } from '../../../src/utils/ssh.js';

// Mock the is-reachable module that testNetworkConnectivity actually uses
vi.mock('is-reachable', () => ({
  default: vi.fn(),
}));

// Mock the network module
vi.mock('../../../src/utils/network.js', () => ({
  testHostReachability: vi.fn(),
}));

describe('Network connectivity tests', () => {
  let mockTestHostReachability: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Get the mocked function
    const networkModule = await import('../../../src/utils/network.js');
    mockTestHostReachability = vi.mocked(networkModule.testHostReachability);
  });

  it('should return success for a reachable host', async () => {
    // Mock testHostReachability to return success
    mockTestHostReachability.mockResolvedValue({
      success: true,
      message: 'Host reachable-host.com is reachable',
    });

    // Call the function
    const result = await testNetworkConnectivity('reachable-host.com');

    // Verify the result
    expect(result.success).toBe(true);
    expect(result.message).toBe('Host reachable-host.com is reachable');
    expect(mockTestHostReachability).toHaveBeenCalledWith('reachable-host.com');
  });

  it('should return failure for a host that times out', async () => {
    // Mock testHostReachability to return failure
    mockTestHostReachability.mockResolvedValue({
      success: false,
      message: 'Host timeout-host.com is not reachable',
    });

    // Call the function
    const result = await testNetworkConnectivity('timeout-host.com');

    // Verify the result
    expect(result.success).toBe(false);
    expect(result.message).toBe('Host timeout-host.com is not reachable');
    expect(mockTestHostReachability).toHaveBeenCalledWith('timeout-host.com');
  });

  it('should return failure with error message for a host that returns an error', async () => {
    // Mock testHostReachability to return failure with error
    mockTestHostReachability.mockResolvedValue({
      success: false,
      message: 'Error testing reachability of error-host.com: Connection refused',
    });

    // Call the function
    const result = await testNetworkConnectivity('error-host.com');

    // Verify the result
    expect(result.success).toBe(false);
    expect(result.message).toBe('Error testing reachability of error-host.com: Connection refused');
    expect(mockTestHostReachability).toHaveBeenCalledWith('error-host.com');
  });
});
