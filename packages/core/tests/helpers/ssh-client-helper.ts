/**
 * SSH Client Test Helpers
 *
 * This module provides helper functions for testing SSH client functionality.
 */

import { Client } from 'ssh2';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Test SSH connection with key authentication using ssh2 directly
 *
 * This function bypasses any limitations in the node-ssh library
 * and directly uses the ssh2 library for testing.
 *
 * @param host SSH server host
 * @param port SSH server port
 * @param username SSH username
 * @param keyPath Path to private key file
 * @param command Command to execute (default: 'echo "Connection successful"')
 * @returns Promise that resolves with connection result
 */
export async function testSshConnectionWithKey(
  host: string,
  port: number,
  username: string,
  keyPath: string,
  command: string = 'echo "Connection successful"'
): Promise<{ success: boolean; message: string; method?: string }> {
  // Read the key file
  const keyContent = fs.readFileSync(keyPath, 'utf8');

  return new Promise<{ success: boolean; message: string; method?: string }>(resolve => {
    const conn = new Client();

    conn
      .on('ready', () => {
        console.log('Connection successful with key');
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            resolve({ success: false, message: `Exec error: ${err.message}` });
            return;
          }

          let data = '';
          stream.on('data', chunk => {
            data += chunk;
          });

          stream.on('close', () => {
            conn.end();
            resolve({
              success: true,
              message: data.toString().trim(),
              method: 'key',
            });
          });
        });
      })
      .on('error', err => {
        console.error('SSH connection error:', err.message);
        resolve({ success: false, message: err.message });
      })
      .connect({
        host,
        port,
        username,
        privateKey: keyContent,
      });
  });
}

/**
 * Get path to a test SSH key
 *
 * @param keyName Name of the key file (e.g., 'test_rsa_pem')
 * @returns Absolute path to the key file
 */
export function getTestKeyPath(keyName: string): string {
  return path.join(__dirname, '..', 'fixtures', 'ssh', keyName);
}
