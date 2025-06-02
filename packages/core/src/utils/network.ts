/**
 * Network connectivity utilities
 * This module provides functions to test network connectivity
 */

import isReachable from 'is-reachable';

/**
 * Test if a host is reachable
 * @param host Hostname or IP address
 * @param timeout Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to a result object with success status and message
 */
export async function testHostReachability(
  host: string,
  timeout = 5000
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Test if the host is reachable on any port
    const isHostReachable = await isReachable(host, { timeout });

    if (isHostReachable) {
      return {
        success: true,
        message: `Host ${host} is reachable`,
      };
    }
    return {
      success: false,
      message: `Host ${host} is not reachable`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing reachability of ${host}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Test if a specific port on a host is reachable
 * @param host Hostname or IP address
 * @param port Port number
 * @param timeout Timeout in milliseconds (default: 5000)
 * @returns Promise resolving to a result object with success status and message
 */
export async function testPortReachability(
  host: string,
  port: number,
  timeout = 5000
): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Test if the specific port is reachable
    const isPortReachable = await isReachable(`${host}:${port}`, { timeout });

    if (isPortReachable) {
      return {
        success: true,
        message: `Port ${port} on host ${host} is reachable`,
      };
    }
    return {
      success: false,
      message: `Port ${port} on host ${host} is not reachable`,
    };
  } catch (error) {
    return {
      success: false,
      message: `Error testing reachability of port ${port} on ${host}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Special handling for private network addresses
 * Some networks block ping and other test methods for private addresses
 * @param host Hostname or IP address
 * @returns True if the host is a private network address
 */
export function isPrivateNetworkAddress(host: string): boolean {
  // Check if it's localhost
  if (host === 'localhost' || host === '127.0.0.1') {
    return true;
  }

  // Check if it's a private network IP
  if (
    host.startsWith('10.') ||
    host.startsWith('172.16.') ||
    host.startsWith('172.17.') ||
    host.startsWith('172.18.') ||
    host.startsWith('172.19.') ||
    host.startsWith('172.2') ||
    host.startsWith('172.30.') ||
    host.startsWith('172.31.') ||
    host.startsWith('192.168.')
  ) {
    return true;
  }

  return false;
}
