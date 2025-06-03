/**
 * Network Error Detection Utilities
 *
 * This module provides proper error detection for network and SSH connection issues
 * using standard Node.js error codes instead of brittle string matching.
 *
 * Based on Node.js standard error codes:
 * - ECONNREFUSED: Connection refused (port closed/blocked)
 * - EHOSTUNREACH: Host unreachable (network issue)
 * - ENOTFOUND: DNS resolution failed (hostname not found)
 * - ETIMEDOUT: Connection timeout
 * - ECONNRESET: Connection reset by peer
 * - EAI_AGAIN: DNS lookup timeout
 */

import { lookup } from 'node:dns';
import { connect } from 'node:net';
import { promisify } from 'node:util';

const dnsLookup = promisify(lookup);

export interface NetworkErrorDetails {
  type: 'network' | 'port' | 'dns' | 'timeout' | 'unknown';
  code: string;
  message: string;
  isRetryable: boolean;
  suggestions: string[];
}

export interface ConnectivityTestResult {
  success: boolean;
  error?: NetworkErrorDetails;
  duration?: number;
}

/**
 * Detect and categorize network errors using proper error codes
 */
export function detectNetworkError(error: Error | any): NetworkErrorDetails {
  const code = error.code || error.errno || '';
  const message = error.message || String(error);

  switch (code) {
    case 'ENOTFOUND':
      return {
        type: 'dns',
        code,
        message: 'DNS resolution failed - hostname not found',
        isRetryable: false,
        suggestions: [
          'Check if the hostname is spelled correctly',
          'Verify the domain exists and is accessible',
          'Check your DNS settings',
          'Try using an IP address instead',
        ],
      };

    case 'EAI_AGAIN':
      return {
        type: 'dns',
        code,
        message: 'DNS lookup timeout - temporary DNS failure',
        isRetryable: true,
        suggestions: [
          'Retry the connection after a short delay',
          'Check your internet connection',
          'Try using a different DNS server',
          'Check if your network has DNS issues',
        ],
      };

    case 'ECONNREFUSED':
      return {
        type: 'port',
        code,
        message: 'Connection refused - port is closed or blocked',
        isRetryable: false,
        suggestions: [
          'Check if the SSH service is running on the target server',
          'Verify the port number is correct (default SSH port is 22)',
          'Check if a firewall is blocking the connection',
          'Ensure the service is listening on the specified port',
        ],
      };

    case 'EHOSTUNREACH':
      return {
        type: 'network',
        code,
        message: 'Host unreachable - no route to host',
        isRetryable: false,
        suggestions: [
          'Check your network connection',
          'Verify the host IP address is correct',
          'Check if there are routing issues',
          'Ensure the host is online and accessible',
        ],
      };

    case 'ETIMEDOUT':
      return {
        type: 'timeout',
        code,
        message: 'Connection timeout - host did not respond in time',
        isRetryable: true,
        suggestions: [
          'Retry with a longer timeout',
          'Check if the host is responding slowly',
          'Verify network connectivity',
          'Check if there are network congestion issues',
        ],
      };

    case 'ECONNRESET':
      return {
        type: 'network',
        code,
        message: 'Connection reset by peer',
        isRetryable: true,
        suggestions: [
          'Retry the connection',
          'Check if the server is overloaded',
          'Verify network stability',
          'Check server logs for issues',
        ],
      };

    default:
      // Fallback to string matching for non-standard errors
      if (message.toLowerCase().includes('timeout')) {
        return {
          type: 'timeout',
          code: code || 'TIMEOUT',
          message: 'Connection timeout detected',
          isRetryable: true,
          suggestions: ['Retry with a longer timeout', 'Check network connectivity'],
        };
      }

      if (message.toLowerCase().includes('refused')) {
        return {
          type: 'port',
          code: code || 'CONNECTION_REFUSED',
          message: 'Connection refused detected',
          isRetryable: false,
          suggestions: ['Check if the service is running', 'Verify the port number'],
        };
      }

      return {
        type: 'unknown',
        code: code || 'UNKNOWN',
        message: `Unknown network error: ${message}`,
        isRetryable: false,
        suggestions: ['Check the error details', 'Verify network configuration'],
      };
  }
}

/**
 * Test DNS resolution for a hostname
 */
export async function testDnsResolution(
  hostname: string,
  timeout = 5000
): Promise<ConnectivityTestResult> {
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    await dnsLookup(hostname);
    clearTimeout(timeoutId);

    return {
      success: true,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: detectNetworkError(error),
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Test TCP port connectivity
 */
export async function testPortConnectivity(
  hostname: string,
  port: number,
  timeout = 5000
): Promise<ConnectivityTestResult> {
  const startTime = Date.now();

  return new Promise(resolve => {
    const socket = connect(port, hostname);

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        success: false,
        error: {
          type: 'timeout',
          code: 'ETIMEDOUT',
          message: `Port ${port} connection timeout after ${timeout}ms`,
          isRetryable: true,
          suggestions: ['Increase timeout', 'Check if port is accessible'],
        },
        duration: Date.now() - startTime,
      });
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timeoutId);
      cleanup();
      resolve({
        success: true,
        duration: Date.now() - startTime,
      });
    });

    socket.on('error', error => {
      clearTimeout(timeoutId);
      cleanup();
      resolve({
        success: false,
        error: detectNetworkError(error),
        duration: Date.now() - startTime,
      });
    });
  });
}

/**
 * Comprehensive network diagnostics
 */
export async function diagnoseNetworkConnectivity(
  hostname: string,
  port: number,
  timeout = 5000
): Promise<{
  dns: ConnectivityTestResult;
  port: ConnectivityTestResult;
  overall: {
    success: boolean;
    primaryIssue: 'dns' | 'port' | 'none';
    recommendations: string[];
  };
}> {
  // Test DNS resolution first
  const dnsResult = await testDnsResolution(hostname, timeout);

  // Only test port if DNS resolution succeeds
  let portResult: ConnectivityTestResult;
  if (dnsResult.success) {
    portResult = await testPortConnectivity(hostname, port, timeout);
  } else {
    portResult = {
      success: false,
      error: {
        type: 'dns',
        code: 'DNS_PREREQUISITE_FAILED',
        message: 'Port test skipped due to DNS resolution failure',
        isRetryable: false,
        suggestions: ['Resolve DNS issues first'],
      },
    };
  }

  // Determine overall status and recommendations
  let primaryIssue: 'dns' | 'port' | 'none' = 'none';
  const recommendations: string[] = [];

  if (!dnsResult.success) {
    primaryIssue = 'dns';
    recommendations.push(...(dnsResult.error?.suggestions || []));
  } else if (!portResult.success) {
    primaryIssue = 'port';
    recommendations.push(...(portResult.error?.suggestions || []));
  }

  return {
    dns: dnsResult,
    port: portResult,
    overall: {
      success: dnsResult.success && portResult.success,
      primaryIssue,
      recommendations,
    },
  };
}

/**
 * Enhanced error detection for SSH-specific errors
 */
export function detectSshError(error: Error | any): NetworkErrorDetails {
  const baseError = detectNetworkError(error);
  const message = error.message || String(error);

  // SSH-specific error patterns
  if (message.includes('Authentication failed') || message.includes('Permission denied')) {
    return {
      type: 'unknown', // This is an auth error, not a network error
      code: 'SSH_AUTH_FAILED',
      message: 'SSH authentication failed',
      isRetryable: false,
      suggestions: [
        'Check your username and password',
        'Verify SSH key permissions and path',
        'Ensure the user has SSH access on the server',
        'Check if the authentication method is supported',
      ],
    };
  }

  if (message.includes('Host key verification failed')) {
    return {
      type: 'unknown',
      code: 'SSH_HOST_KEY_FAILED',
      message: 'SSH host key verification failed',
      isRetryable: false,
      suggestions: [
        'Update your known_hosts file',
        "Verify the server's host key",
        'Use ssh-keyscan to get the correct host key',
        'Check if the server key has changed',
      ],
    };
  }

  // For SSH connections, enhance network error suggestions
  if (baseError.type === 'port' && baseError.code === 'ECONNREFUSED') {
    return {
      ...baseError,
      suggestions: [
        'Check if SSH daemon (sshd) is running on the server',
        'Verify the SSH port (default is 22)',
        'Check firewall rules on both client and server',
        'Ensure SSH service is enabled and started',
      ],
    };
  }

  return baseError;
}

/**
 * Check if an error is retryable based on its type and code
 */
export function isRetryableError(error: Error | any): boolean {
  const errorDetails = detectNetworkError(error);
  return errorDetails.isRetryable;
}

/**
 * Get user-friendly error message with suggestions
 */
export function getErrorMessage(error: Error | any, context = 'connection'): string {
  const errorDetails = detectNetworkError(error);

  let message = `${context} failed: ${errorDetails.message}`;

  if (errorDetails.suggestions.length > 0) {
    message += '\n\nSuggestions:';
    errorDetails.suggestions.forEach((suggestion, index) => {
      message += `\n  ${index + 1}. ${suggestion}`;
    });
  }

  return message;
}
