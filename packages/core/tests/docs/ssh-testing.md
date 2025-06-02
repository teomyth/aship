# SSH Testing Guide

This document provides guidance on how to properly test SSH functionality in the Aship project.

## Current Challenges

Testing SSH functionality is challenging for several reasons:

1. **Protocol Complexity**: SSH involves complex handshake and authentication protocols
2. **Cryptographic Requirements**: Modern OpenSSL versions have disabled older algorithms
3. **Authentication Mechanisms**: Proper setup of keys and authentication methods is required
4. **Environment Dependencies**: SSH testing often depends on system-level configurations

## Recommended Testing Approaches

### Option 1: Docker-based Testing Environment

The most reliable approach is to use Docker containers with controlled SSH server environments:

```typescript
// Example of Docker-based SSH testing setup
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function setupDockerSshServer() {
  // Start a Docker container with SSH server
  await execAsync('docker run -d --name ssh-test -p 2222:22 linuxserver/openssh-server');
  
  // Wait for the server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Copy test keys to the container
  await execAsync('docker cp ./tests/fixtures/ssh/test_rsa.pub ssh-test:/root/.ssh/authorized_keys');
  
  // Set proper permissions
  await execAsync('docker exec ssh-test chmod 600 /root/.ssh/authorized_keys');
  
  return {
    host: 'localhost',
    port: 2222,
    user: 'root',
  };
}

async function teardownDockerSshServer() {
  await execAsync('docker stop ssh-test');
  await execAsync('docker rm ssh-test');
}
```

### Option 2: Use ED25519 Keys Instead of RSA

ED25519 keys have better compatibility with modern OpenSSL versions:

```bash
# Generate ED25519 keys for testing
ssh-keygen -t ed25519 -f ./tests/fixtures/ssh/test_ed25519 -N ""
```

Then update the SSH server implementation to use these keys:

```typescript
const server = new Server({
  hostKeys: [fs.readFileSync('./tests/fixtures/ssh/test_ed25519')]
});
```

### Option 3: Mock the SSH Client

For unit tests, consider mocking the SSH client instead of using a real server:

```typescript
// Mock the NodeSSH class
vi.mock('node-ssh', () => {
  return {
    NodeSSH: vi.fn().mockImplementation(() => {
      return {
        connect: vi.fn().mockResolvedValue(true),
        execCommand: vi.fn().mockResolvedValue({
          stdout: 'Connection successful',
          stderr: '',
          code: 0,
        }),
        dispose: vi.fn(),
      };
    }),
  };
});
```

## Future Improvements

To improve SSH testing in the future:

1. **Standardize Test Environment**: Create a consistent Docker-based test environment
2. **Use Modern Key Types**: Prefer ED25519 keys over RSA for better compatibility
3. **Separate Unit and Integration Tests**: Use mocks for unit tests, real servers for integration tests
4. **Detailed Error Handling**: Improve error handling and reporting in SSH-related code

## References

- [SSH2 Library Documentation](https://github.com/mscdex/ssh2)
- [Node-SSH Documentation](https://github.com/steelbrain/node-ssh)
- [OpenSSH Testing Best Practices](https://www.openssh.com/specs.html)
