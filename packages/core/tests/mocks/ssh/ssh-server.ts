/**
 * SSH Server Mock for Testing
 *
 * This module provides a mock SSH server implementation for testing SSH client functionality.
 * It uses the ssh2 library to create a server that can accept various authentication methods.
 */

import { Server } from 'ssh2';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Constants for testing
export const TEST_SSH_PORT = 2222;
export const TEST_SSH_HOST = '127.0.0.1';
export const TEST_SSH_USER = 'test';
export const TEST_SSH_PASSWORD = 'password';

/**
 * Create and start a simple SSH server for testing
 * @returns SSH server instance
 */
export async function startSshServer(): Promise<Server> {
  // Path to test keys
  const testKeyDir = path.join(__dirname, '..', '..', 'fixtures', 'ssh_keys');
  const privateKeyPath = path.join(testKeyDir, 'test_rsa_pem');

  // Read the private key
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

  // Create the server
  const server = new Server({
    hostKeys: [privateKey],
  });

  // Set up authentication and session handling
  server.on('connection', client => {
    console.log('Client connected');

    client.on('authentication', ctx => {
      // Accept password authentication
      if (
        ctx.method === 'password' &&
        ctx.username === TEST_SSH_USER &&
        ctx.password === TEST_SSH_PASSWORD
      ) {
        console.log('Password authentication successful');
        return ctx.accept();
      }

      // Accept publickey authentication
      if (ctx.method === 'publickey' && ctx.username === TEST_SSH_USER) {
        // In testing, we can accept any key without verification
        console.log('Public key authentication attempt:', ctx.username);
        console.log(
          'Key info:',
          ctx.key ? { algo: ctx.key.algo, data: ctx.key.data.length + ' bytes' } : 'No key data'
        );
        // For publickey authentication, we need to check if this is just a query
        if (ctx.signature) {
          // This is an actual authentication attempt with signature
          console.log('Authentication with signature');
          return ctx.accept();
        } else {
          // This is just a query to check if the key is acceptable
          console.log('Key query (no signature)');
          return ctx.accept();
        }
      }

      // Reject all other authentication attempts
      console.log('Authentication failed:', ctx.method, ctx.username);
      ctx.reject();
    });

    client.on('ready', () => {
      console.log('Client authenticated and ready');

      client.on('session', accept => {
        const session = accept();

        session.on('exec', (accept, _, info) => {
          console.log(`Executing command: ${info.command}`);
          const stream = accept();

          // Echo the command back or return success message
          if (info.command === 'echo "Connection successful"') {
            stream.write('Connection successful\n');
            stream.exit(0);
            stream.end();
          } else if (info.command.startsWith('echo')) {
            // Echo any echo command
            const message = info.command.substring(5).trim().replace(/^"|"$/g, '');
            stream.write(`${message}\n`);
            stream.exit(0);
            stream.end();
          } else {
            stream.stderr.write(`Unknown command: ${info.command}\n`);
            stream.exit(1);
            stream.end();
          }
        });
      });
    });

    client.on('error', err => {
      console.error('Client error:', err);
    });
  });

  // Start listening
  await new Promise<void>(resolve => {
    server.listen(TEST_SSH_PORT, TEST_SSH_HOST, () => {
      console.log(`SSH server listening on ${TEST_SSH_HOST}:${TEST_SSH_PORT}`);
      resolve();
    });
  });

  return server;
}

/**
 * Stop the SSH server
 * @param server Server instance to stop
 */
export async function stopSshServer(server: Server): Promise<void> {
  await new Promise<void>(resolve => {
    server.close(() => {
      console.log('SSH server stopped');
      resolve();
    });
  });
}
