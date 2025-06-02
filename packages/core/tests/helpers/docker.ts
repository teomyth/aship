/**
 * Helper functions for Docker-based integration tests
 */

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { generateTempDirName } from './ssh-keys';

const execAsync = promisify(exec);

/**
 * Options for creating an SSH server container
 */
export interface SSHServerOptions {
  containerName?: string;
  port?: number;
  username?: string;
  password?: string;
  sudoPassword?: string;
  publicKeyPath?: string;
  addToSudoers?: boolean;
}

/**
 * Create and start a Docker container with an SSH server
 * @param options Options for the SSH server
 * @returns Information about the created container
 */
export async function createSSHServerContainer(options: SSHServerOptions = {}): Promise<{
  containerName: string;
  port: number;
  username: string;
  password: string;
  sudoPassword: string;
  dockerfilePath: string;
}> {
  // Set default options
  const containerName = options.containerName || `aship-ssh-test-${generateTempDirName()}`;
  const port = options.port || 2222;
  const username = options.username || 'testuser';
  const password = options.password || 'testpassword';
  const sudoPassword = options.sudoPassword || 'sudopassword';
  const addToSudoers = options.addToSudoers !== undefined ? options.addToSudoers : true;

  // Create a temporary directory for Docker files
  const tmpDir = path.join(process.cwd(), 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  const dockerDir = fs.mkdtempSync(path.join(tmpDir, 'docker-'));
  fs.mkdirSync(dockerDir, { recursive: true });

  // Create Dockerfile content
  let dockerfileContent = `
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y openssh-server sudo && \\
    mkdir /var/run/sshd && \\
    echo 'PermitRootLogin no' >> /etc/ssh/sshd_config && \\
    echo 'PasswordAuthentication yes' >> /etc/ssh/sshd_config && \\
    echo 'PubkeyAuthentication yes' >> /etc/ssh/sshd_config

# Create test user
RUN useradd -m -s /bin/bash ${username} && \\
    echo "${username}:${password}" | chpasswd && \\
    mkdir -p /home/${username}/.ssh && \\
    chmod 700 /home/${username}/.ssh && \\
    chown -R ${username}:${username} /home/${username}/.ssh
`;

  // Add public key if provided
  if (options.publicKeyPath) {
    const publicKey = fs.readFileSync(options.publicKeyPath, 'utf8').trim();
    dockerfileContent += `
# Add SSH public key
RUN echo "${publicKey}" > /home/${username}/.ssh/authorized_keys && \\
    chmod 600 /home/${username}/.ssh/authorized_keys && \\
    chown ${username}:${username} /home/${username}/.ssh/authorized_keys
`;
  }

  // Add sudo configuration if requested
  if (addToSudoers) {
    dockerfileContent += `
# Add user to sudo group
RUN usermod -aG sudo ${username} && \\
    echo "${username} ALL=(ALL) PASSWD: ALL" > /etc/sudoers.d/${username} && \\
    chmod 0440 /etc/sudoers.d/${username}

# Set sudo password
RUN echo "${username}:${sudoPassword}" | chpasswd
`;
  }

  // Finish Dockerfile
  dockerfileContent += `
EXPOSE 22

CMD ["/usr/sbin/sshd", "-D"]
`;

  // Write Dockerfile
  const dockerfilePath = path.join(dockerDir, 'Dockerfile');
  fs.writeFileSync(dockerfilePath, dockerfileContent);

  // Build Docker image
  console.log(`Building Docker image for SSH server (${containerName})...`);
  await execAsync(`docker build -t ${containerName}-image -f ${dockerfilePath} ${dockerDir}`);

  // Start container
  console.log(`Starting SSH server container (${containerName})...`);
  await execAsync(`docker run -d --name ${containerName} -p ${port}:22 ${containerName}-image`);

  // Wait for SSH server to start
  console.log('Waiting for SSH server to start...');
  await new Promise(resolve => setTimeout(resolve, 2000));

  return {
    containerName,
    port,
    username,
    password,
    sudoPassword,
    dockerfilePath,
  };
}

/**
 * Stop and remove a Docker container
 * @param containerName Name of the container to stop and remove
 */
export async function removeContainer(containerName: string): Promise<void> {
  try {
    console.log(`Stopping container ${containerName}...`);
    await execAsync(`docker stop ${containerName}`);
    console.log(`Removing container ${containerName}...`);
    await execAsync(`docker rm ${containerName}`);
  } catch (error) {
    console.error(`Error removing container ${containerName}:`, error);
  }
}

/**
 * Check if Docker is available
 * @returns True if Docker is available, false otherwise
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await execAsync('docker --version');
    return true;
  } catch (error) {
    return false;
  }
}
