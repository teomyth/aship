/**
 * SSH Authentication Method Detection
 *
 * This module provides intelligent detection of SSH authentication methods
 * supported by a server, replacing hardcoded string matching with proper
 * SSH protocol analysis.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface AuthMethodInfo {
  method: 'password' | 'publickey' | 'keyboard-interactive' | 'gssapi-with-mic';
  available: boolean;
  preferred: boolean;
}

export interface AuthDetectionResult {
  success: boolean;
  supportedMethods: AuthMethodInfo[];
  preferredMethod: string | null;
  serverBanner?: string;
  error?: string;
}

export interface AuthStrategy {
  strategy: 'password-only' | 'key-only' | 'multiple-methods' | 'unknown';
  primaryMethod: string;
  fallbackMethods: string[];
  shouldPromptUser: boolean;
}

/**
 * Detect supported authentication methods using SSH client
 */
export async function detectAuthMethods(
  hostname: string,
  port = 22,
  username = 'root',
  timeout = 10000
): Promise<AuthDetectionResult> {
  try {
    // Use SSH with verbose output to detect supported auth methods
    // -o BatchMode=yes prevents interactive prompts
    // -o PreferredAuthentications=none forces auth method enumeration
    const sshCommand = [
      'ssh',
      '-v',
      '-o',
      'BatchMode=yes',
      '-o',
      'PreferredAuthentications=none',
      '-o',
      `ConnectTimeout=${Math.floor(timeout / 1000)}`,
      '-o',
      'StrictHostKeyChecking=no',
      '-o',
      'UserKnownHostsFile=/dev/null',
      '-p',
      port.toString(),
      `${username}@${hostname}`,
      'exit',
    ].join(' ');

    const { stdout, stderr } = await execAsync(sshCommand);

    return parseAuthMethodsFromSshOutput(stderr, stdout);
  } catch (error: any) {
    // SSH will always "fail" when we use PreferredAuthentications=none
    // The error output contains the auth methods information
    const stderr = error.stderr || '';
    const stdout = error.stdout || '';

    if (stderr || stdout) {
      return parseAuthMethodsFromSshOutput(stderr, stdout);
    }

    return {
      success: false,
      supportedMethods: [],
      preferredMethod: null,
      error: `Failed to detect auth methods: ${error.message}`,
    };
  }
}

/**
 * Parse SSH output to extract supported authentication methods
 */
function parseAuthMethodsFromSshOutput(stderr: string, stdout: string): AuthDetectionResult {
  const output = stderr + stdout;
  const supportedMethods: AuthMethodInfo[] = [];
  let serverBanner: string | undefined;

  // Extract server banner
  const bannerMatch = output.match(/Remote protocol version [^,]+, remote software version (.+)/);
  if (bannerMatch) {
    serverBanner = bannerMatch[1].trim();
  }

  // Look for "Authentications that can continue" line
  const authLineMatch = output.match(/Authentications that can continue: (.+)/);
  if (authLineMatch) {
    const methods = authLineMatch[1].split(',').map(m => m.trim());

    methods.forEach(method => {
      switch (method) {
        case 'password':
          supportedMethods.push({
            method: 'password',
            available: true,
            preferred: false,
          });
          break;
        case 'publickey':
          supportedMethods.push({
            method: 'publickey',
            available: true,
            preferred: true, // Generally preferred for security
          });
          break;
        case 'keyboard-interactive':
          supportedMethods.push({
            method: 'keyboard-interactive',
            available: true,
            preferred: false,
          });
          break;
        case 'gssapi-with-mic':
          supportedMethods.push({
            method: 'gssapi-with-mic',
            available: true,
            preferred: false,
          });
          break;
      }
    });
  }

  // Determine preferred method
  const preferredMethod =
    supportedMethods.find(m => m.preferred)?.method || supportedMethods[0]?.method || null;

  return {
    success: supportedMethods.length > 0,
    supportedMethods,
    preferredMethod,
    serverBanner,
  };
}

/**
 * Determine authentication strategy based on detected methods
 */
export function determineAuthStrategy(
  detectionResult: AuthDetectionResult,
  hasDefaultKeys = true
): AuthStrategy {
  if (!detectionResult.success || detectionResult.supportedMethods.length === 0) {
    return {
      strategy: 'unknown',
      primaryMethod: 'publickey', // Default fallback
      fallbackMethods: ['password'],
      shouldPromptUser: true,
    };
  }

  const methods = detectionResult.supportedMethods;
  const hasPassword = methods.some(m => m.method === 'password');
  const hasPublicKey = methods.some(m => m.method === 'publickey');
  const hasKeyboardInteractive = methods.some(m => m.method === 'keyboard-interactive');

  // Server only supports password authentication
  if (hasPassword && !hasPublicKey && !hasKeyboardInteractive) {
    return {
      strategy: 'password-only',
      primaryMethod: 'password',
      fallbackMethods: [],
      shouldPromptUser: true,
    };
  }

  // Server only supports public key authentication
  if (hasPublicKey && !hasPassword && !hasKeyboardInteractive) {
    return {
      strategy: 'key-only',
      primaryMethod: 'publickey',
      fallbackMethods: [],
      shouldPromptUser: !hasDefaultKeys, // Only prompt if no default keys available
    };
  }

  // Server supports multiple methods
  if (methods.length > 1) {
    const primaryMethod = hasPublicKey ? 'publickey' : 'password';
    const fallbackMethods = methods.filter(m => m.method !== primaryMethod).map(m => m.method);

    return {
      strategy: 'multiple-methods',
      primaryMethod,
      fallbackMethods,
      shouldPromptUser: !hasDefaultKeys || !hasPublicKey,
    };
  }

  // Single method (not password-only or key-only)
  return {
    strategy: 'unknown',
    primaryMethod: methods[0].method,
    fallbackMethods: [],
    shouldPromptUser: true,
  };
}

/**
 * Quick check if server requires password authentication
 */
export async function requiresPasswordAuth(
  hostname: string,
  port = 22,
  username = 'root'
): Promise<boolean> {
  const result = await detectAuthMethods(hostname, port, username);
  const strategy = determineAuthStrategy(result);
  return strategy.strategy === 'password-only';
}

/**
 * Quick check if server supports only public key authentication
 */
export async function requiresKeyAuth(
  hostname: string,
  port = 22,
  username = 'root'
): Promise<boolean> {
  const result = await detectAuthMethods(hostname, port, username);
  const strategy = determineAuthStrategy(result);
  return strategy.strategy === 'key-only';
}

/**
 * Get human-readable description of authentication requirements
 */
export function getAuthDescription(strategy: AuthStrategy): string {
  switch (strategy.strategy) {
    case 'password-only':
      return 'Server requires password authentication';
    case 'key-only':
      return 'Server requires SSH key authentication';
    case 'multiple-methods':
      return `Server supports multiple authentication methods (primary: ${strategy.primaryMethod})`;
    default:
      return 'Authentication requirements unknown';
  }
}
