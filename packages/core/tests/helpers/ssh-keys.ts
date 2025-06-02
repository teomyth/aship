/**
 * Helper functions for generating SSH keys for tests
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Generate a random temporary directory name
 * @returns Random directory name
 */
export function generateTempDirName(): string {
  return `aship-test-${crypto.randomBytes(8).toString('hex')}`;
}

/**
 * Generate SSH keys for testing
 * @param keyName Name of the key file (without extension)
 * @returns Object containing paths to the generated keys
 */
export async function generateSSHKeys(keyName: string = 'id_rsa'): Promise<{
  privateKeyPath: string;
  publicKeyPath: string;
  keyDir: string;
}> {
  // Create a temporary directory for the keys
  const keyDir = path.join(os.tmpdir(), generateTempDirName());
  fs.mkdirSync(keyDir, { recursive: true });

  // Generate the key paths
  const privateKeyPath = path.join(keyDir, keyName);
  const publicKeyPath = `${privateKeyPath}.pub`;

  // Generate the SSH key pair
  await execAsync(`ssh-keygen -t rsa -b 2048 -f ${privateKeyPath} -N "" -q`);

  return {
    privateKeyPath,
    publicKeyPath,
    keyDir,
  };
}

/**
 * Clean up generated SSH keys
 * @param keyPaths Object containing paths to the keys
 */
export function cleanupSSHKeys(keyPaths: {
  privateKeyPath: string;
  publicKeyPath: string;
  keyDir: string;
}): void {
  try {
    // Remove the key files
    if (fs.existsSync(keyPaths.privateKeyPath)) {
      fs.unlinkSync(keyPaths.privateKeyPath);
    }
    if (fs.existsSync(keyPaths.publicKeyPath)) {
      fs.unlinkSync(keyPaths.publicKeyPath);
    }

    // Remove the directory
    if (fs.existsSync(keyPaths.keyDir)) {
      fs.rmdirSync(keyPaths.keyDir, { recursive: true });
    }
  } catch (error) {
    console.error('Error cleaning up SSH keys:', error);
  }
}

/**
 * Read the content of a public key file
 * @param publicKeyPath Path to the public key file
 * @returns Content of the public key
 */
export function readPublicKey(publicKeyPath: string): string {
  return fs.readFileSync(publicKeyPath, 'utf8').trim();
}
