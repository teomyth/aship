/**
 * Tests for Network Error Detection
 */

import { describe, it, expect } from 'vitest';
import {
  detectNetworkError,
  detectSshError,
  isRetryableError,
  getErrorMessage
} from '../../src/utils/network-error-detector.js';

describe('Network Error Detection', () => {
  describe('detectNetworkError', () => {
    it('should detect DNS resolution errors', () => {
      const error = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND example.invalid' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('dns');
      expect(result.code).toBe('ENOTFOUND');
      expect(result.isRetryable).toBe(false);
      expect(result.suggestions).toContain('Check if the hostname is spelled correctly');
    });

    it('should detect connection refused errors', () => {
      const error = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:22' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('port');
      expect(result.code).toBe('ECONNREFUSED');
      expect(result.isRetryable).toBe(false);
      expect(result.suggestions).toContain('Check if the SSH service is running on the target server');
    });

    it('should detect timeout errors', () => {
      const error = { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 192.168.1.100:22' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('timeout');
      expect(result.code).toBe('ETIMEDOUT');
      expect(result.isRetryable).toBe(true);
      expect(result.suggestions).toContain('Retry with a longer timeout');
    });

    it('should detect host unreachable errors', () => {
      const error = { code: 'EHOSTUNREACH', message: 'connect EHOSTUNREACH 10.0.0.1:22' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('network');
      expect(result.code).toBe('EHOSTUNREACH');
      expect(result.isRetryable).toBe(false);
      expect(result.suggestions).toContain('Check your network connection');
    });

    it('should detect DNS lookup timeout errors', () => {
      const error = { code: 'EAI_AGAIN', message: 'getaddrinfo EAI_AGAIN dns.invalid' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('dns');
      expect(result.code).toBe('EAI_AGAIN');
      expect(result.isRetryable).toBe(true);
      expect(result.suggestions).toContain('Retry the connection after a short delay');
    });

    it('should handle unknown errors with fallback to string matching', () => {
      const error = { message: 'Connection timeout occurred' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('timeout');
      expect(result.isRetryable).toBe(true);
    });

    it('should handle completely unknown errors', () => {
      const error = { message: 'Some unknown error' };
      const result = detectNetworkError(error);
      
      expect(result.type).toBe('unknown');
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('detectSshError', () => {
    it('should detect SSH authentication failures', () => {
      const error = { message: 'Authentication failed for user admin' };
      const result = detectSshError(error);
      
      expect(result.code).toBe('SSH_AUTH_FAILED');
      expect(result.isRetryable).toBe(false);
      expect(result.suggestions).toContain('Check your username and password');
    });

    it('should detect SSH host key verification failures', () => {
      const error = { message: 'Host key verification failed' };
      const result = detectSshError(error);
      
      expect(result.code).toBe('SSH_HOST_KEY_FAILED');
      expect(result.isRetryable).toBe(false);
      expect(result.suggestions).toContain('Update your known_hosts file');
    });

    it('should enhance connection refused errors for SSH', () => {
      const error = { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:22' };
      const result = detectSshError(error);
      
      expect(result.type).toBe('port');
      expect(result.code).toBe('ECONNREFUSED');
      expect(result.suggestions).toContain('Check if SSH daemon (sshd) is running on the server');
    });

    it('should fall back to network error detection for non-SSH errors', () => {
      const error = { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT 192.168.1.100:22' };
      const result = detectSshError(error);
      
      expect(result.type).toBe('timeout');
      expect(result.code).toBe('ETIMEDOUT');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      const retryableErrors = [
        { code: 'ETIMEDOUT' },
        { code: 'EAI_AGAIN' },
        { code: 'ECONNRESET' }
      ];

      retryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(true);
      });
    });

    it('should identify non-retryable errors', () => {
      const nonRetryableErrors = [
        { code: 'ENOTFOUND' },
        { code: 'ECONNREFUSED' },
        { code: 'EHOSTUNREACH' }
      ];

      nonRetryableErrors.forEach(error => {
        expect(isRetryableError(error)).toBe(false);
      });
    });
  });

  describe('getErrorMessage', () => {
    it('should generate user-friendly error messages with suggestions', () => {
      const error = { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND example.invalid' };
      const message = getErrorMessage(error, 'SSH connection');
      
      expect(message).toContain('SSH connection failed');
      expect(message).toContain('DNS resolution failed');
      expect(message).toContain('Suggestions:');
      expect(message).toContain('1. Check if the hostname is spelled correctly');
    });

    it('should handle errors without suggestions', () => {
      const error = { code: 'UNKNOWN', message: 'Unknown error' };
      const message = getErrorMessage(error, 'connection');
      
      expect(message).toContain('connection failed');
      expect(message).toContain('Unknown network error');
    });
  });
});
