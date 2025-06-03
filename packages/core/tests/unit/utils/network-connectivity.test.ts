/**
 * Unit tests for network connectivity functions
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { diagnoseNetworkConnectivity } from '../../../src/utils/network-error-detector.js';

// Mock the Node.js dns module
vi.mock('node:dns', () => ({
  lookup: vi.fn(),
}));

// Mock the Node.js net module
vi.mock('node:net', () => ({
  connect: vi.fn(),
}));

describe('Network connectivity tests', () => {
  let mockLookup: any;
  let mockConnect: any;

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();

    // Get the mocked functions
    const dnsModule = await import('node:dns');
    const netModule = await import('node:net');
    mockLookup = vi.mocked(dnsModule.lookup);
    mockConnect = vi.mocked(netModule.connect);
  });

  it('should return success for a reachable host', async () => {
    // Mock successful DNS resolution
    mockLookup.mockImplementation((hostname, callback) => {
      callback(null, '1.2.3.4', 4);
    });

    // Mock successful port connection
    const mockSocket = {
      on: vi.fn((event, callback) => {
        if (event === 'connect') {
          setTimeout(callback, 10);
        }
        return mockSocket;
      }),
      removeAllListeners: vi.fn(),
      destroy: vi.fn(),
    };
    mockConnect.mockReturnValue(mockSocket);

    // Call the function
    const result = await diagnoseNetworkConnectivity('reachable-host.com', 22);

    // Verify the result
    expect(result.overall.success).toBe(true);
    expect(result.dns.success).toBe(true);
    expect(result.port.success).toBe(true);
  });

  it('should return failure for DNS resolution failure', async () => {
    // Mock DNS resolution failure
    mockLookup.mockImplementation((hostname, callback) => {
      const error = new Error('getaddrinfo ENOTFOUND nonexistent.invalid');
      (error as any).code = 'ENOTFOUND';
      callback(error);
    });

    // Call the function
    const result = await diagnoseNetworkConnectivity('nonexistent.invalid', 22);

    // Verify the result
    expect(result.overall.success).toBe(false);
    expect(result.dns.success).toBe(false);
    expect(result.dns.error?.type).toBe('dns');
    expect(result.dns.error?.code).toBe('ENOTFOUND');
  });

  it('should return failure for port connection failure', async () => {
    // Mock successful DNS resolution
    mockLookup.mockImplementation((hostname, callback) => {
      callback(null, '1.2.3.4', 4);
    });

    // Mock port connection failure
    const mockSocket = {
      on: vi.fn((event, callback) => {
        if (event === 'error') {
          const error = new Error('connect ECONNREFUSED 1.2.3.4:22');
          (error as any).code = 'ECONNREFUSED';
          setTimeout(() => callback(error), 10);
        }
        return mockSocket;
      }),
      removeAllListeners: vi.fn(),
      destroy: vi.fn(),
    };
    mockConnect.mockReturnValue(mockSocket);

    // Call the function
    const result = await diagnoseNetworkConnectivity('unreachable-host.com', 22);

    // Verify the result
    expect(result.overall.success).toBe(false);
    expect(result.dns.success).toBe(true);
    expect(result.port.success).toBe(false);
    expect(result.port.error?.type).toBe('port');
    expect(result.port.error?.code).toBe('ECONNREFUSED');
  });
});
