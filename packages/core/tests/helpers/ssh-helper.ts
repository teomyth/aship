/**
 * SSH Test Helpers
 *
 * This module provides helper functions for SSH testing.
 */

import { Server } from 'ssh2';
import * as path from 'node:path';
import { startSshServer, stopSshServer, TEST_SSH_PORT } from '../mocks/ssh/ssh-server';

/**
 * Get the path to a fixture file
 * @param fixturePath Relative path within fixtures directory
 * @returns Absolute path to the fixture file
 */
export function getFixturePath(fixturePath: string): string {
  return path.join(__dirname, '..', 'fixtures', fixturePath);
}

/**
 * Run a test with a mock SSH server
 * @param callback Test callback function
 * @returns Promise that resolves when the test is complete
 */
export async function withSshServer<T>(
  callback: (port: number, server: Server) => Promise<T>
): Promise<T> {
  const server = await startSshServer();

  try {
    return await callback(TEST_SSH_PORT, server);
  } finally {
    await stopSshServer(server);
  }
}

/**
 * Wait for a specified amount of time
 * @param ms Milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
