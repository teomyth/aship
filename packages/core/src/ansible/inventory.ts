/**
 * Ansible inventory generator
 */

import * as fs from 'node:fs/promises';
import os from 'node:os';
import * as path from 'node:path';
import { sessionPasswordManager } from '../ssh/session-password-manager.js';
import type { ServerConfig } from '../types/index.js';
import { logger } from '../utils/logger.js';

/**
 * Options for generating inventory file
 */
interface InventoryOptions {
  /**
   * Extra variables to include in the inventory
   */
  extraVars?: Record<string, any>;
}

/**
 * Generate Ansible inventory file
 * @param servers Server configurations
 * @param options Inventory options
 * @returns Path to the generated inventory file
 */
async function generateInventoryFile(
  servers: ServerConfig[],
  options: InventoryOptions = {}
): Promise<string> {
  // Create temporary file
  const tempFile = path.join(os.tmpdir(), `aship-inventory-${Date.now()}.ini`);

  // Generate inventory content using the existing function
  const content = await generateInventoryContent(servers, options);

  // Write to file
  await fs.writeFile(tempFile, content, 'utf-8');

  return tempFile;
}

/**
 * Generate inventory content for Ansible
 * @param servers Server configurations
 * @param options Inventory options
 * @returns Inventory content
 */
async function generateInventoryContent(
  servers: ServerConfig[],
  options: InventoryOptions = {}
): Promise<string> {
  let content = '';

  // Add each server to the 'all' section
  content += '[all]\n';
  servers.forEach(server => {
    content += `${server.name} ansible_host=${server.hostname} ansible_port=${server.port} ansible_user=${server.user}`;

    // Add authentication
    if (server.identity_file) {
      // Use ansible_ssh_private_key_file for key authentication
      content += ` ansible_ssh_private_key_file=${server.identity_file}`;
    } else {
      // Try to get password from session password manager
      const password = sessionPasswordManager.getPassword(server.hostname, server.user);

      if (password) {
        content += ` ansible_ssh_pass=${password} ansible_become_pass=${password}`;
        logger.verbose(`Adding password from session for ${server.user}@${server.hostname}`);
      } else {
        // No specific key or password - let SSH handle default authentication
        logger.verbose(`Using SSH default authentication for ${server.user}@${server.hostname}`);
      }
    }

    // Add additional SSH options
    content +=
      ' ansible_ssh_common_args="-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"';

    content += '\n';
  });

  // Add common host groups that might be used in playbooks
  // This ensures compatibility with playbooks that target specific groups
  const commonGroups = ['prod', 'staging', 'dev', 'web', 'db', 'app'];

  for (const group of commonGroups) {
    content += `\n[${group}]\n`;
    servers.forEach(server => {
      content += `${server.name}\n`;
    });
  }

  // Add global variables
  content += '\n[all:vars]\n';
  content += 'ansible_connection=ssh\n';
  content += 'ansible_become=yes\n';
  content += 'ansible_become_method=sudo\n';
  content += 'ansible_ssh_pipelining=true\n';
  content += 'ansible_host_key_checking=false\n';

  // Add extra variables if provided
  if (options.extraVars && Object.keys(options.extraVars).length > 0) {
    for (const [key, value] of Object.entries(options.extraVars)) {
      // Format the value properly
      let formattedValue = value;
      if (typeof value === 'string') {
        // Escape quotes in strings
        formattedValue = value.replace(/"/g, '\\"');
        formattedValue = `"${formattedValue}"`;
      } else if (typeof value === 'boolean') {
        formattedValue = value ? 'true' : 'false';
      }

      content += `${key}=${formattedValue}\n`;
    }
  }

  return content;
}

export { generateInventoryFile, generateInventoryContent };
