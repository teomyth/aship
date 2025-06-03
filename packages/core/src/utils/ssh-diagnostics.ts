import type { ServerConfig } from '../types/index.js';
import logger, { LogLevel } from './logger.js';
import { diagnoseConnection } from './ssh.js';

/**
 * Diagnostic result with detailed information
 */
export interface DetailedDiagnosticResult {
  success: boolean;
  primaryIssue: 'none' | 'network' | 'port' | 'authentication';
  detailedMessage: string;
  networkConnectivity: {
    success: boolean;
    message: string;
    details?: string[];
  };
  sshPortConnectivity: {
    success: boolean;
    message: string;
    details?: string[];
  };
  sshAuthentication: {
    success: boolean;
    message: string;
    method?: string;
    keyPath?: string;
    details?: string[];
    status?: 'accepted' | 'rejected' | 'not-attempted';
  };
  debugInfo?: {
    commandsExecuted: string[];
    systemInfo: Record<string, string>;
    errorDetails?: string;
  };
}

/**
 * Run enhanced SSH diagnostics with detailed logging
 * @param server Server configuration
 * @param options Diagnostic options
 * @returns Detailed diagnostic result
 */
export async function runEnhancedDiagnostics(
  server: ServerConfig,
  options: {
    verbosity?: number;
    showCommands?: boolean;
    suppressDebugOutput?: boolean;
  } = {}
): Promise<DetailedDiagnosticResult> {
  // Create a dedicated logger for SSH diagnostics
  const sshLogger = logger.createChild('ssh');

  // Set verbosity level based on options
  if (options.verbosity !== undefined) {
    sshLogger.setVerbosity(options.verbosity);
  }

  sshLogger.section('SSH Connection Diagnostics');
  sshLogger.info(`Testing connection to ${server.user}@${server.hostname}:${server.port}`);

  // Run the standard diagnostics
  sshLogger.verbose('→ Running connection diagnostics...');
  sshLogger.debug('Using system SSH for connection diagnostics...');

  // Set more detailed log level for diagnostics
  const originalVerbosity = sshLogger.getVerbosity();
  if (options.verbosity && options.verbosity >= 3) {
    sshLogger.debug('Setting maximum verbosity for detailed diagnostics');
    sshLogger.setVerbosity(LogLevel.TRACE);
  }

  const diagnostics = await diagnoseConnection(server, {
    suppressDebugOutput: options.suppressDebugOutput,
  });

  // Restore original log level
  if (options.verbosity && options.verbosity >= 3) {
    sshLogger.setVerbosity(originalVerbosity);
  }

  // Record diagnostic results
  sshLogger.debug('Diagnostics result:', {
    overallSuccess: diagnostics.overallSuccess,
    primaryIssue: diagnostics.primaryIssue,
    networkConnectivity: diagnostics.networkConnectivity,
    sshPortConnectivity: diagnostics.sshPortConnectivity,
    sshAuthentication: {
      success: diagnostics.sshAuthentication.success,
      message: diagnostics.sshAuthentication.message,
      method: diagnostics.sshAuthentication.method,
    },
  });

  // Create enhanced result with more details
  const result: DetailedDiagnosticResult = {
    success: diagnostics.overallSuccess,
    primaryIssue: diagnostics.primaryIssue,
    detailedMessage: diagnostics.detailedMessage,
    networkConnectivity: {
      ...diagnostics.networkConnectivity,
      details: [],
    },
    sshPortConnectivity: {
      ...diagnostics.sshPortConnectivity,
      details: [],
    },
    sshAuthentication: {
      ...diagnostics.sshAuthentication,
      details: [],
      status: diagnostics.sshAuthentication.success ? 'accepted' : 'rejected',
    },
  };

  // Add debug information if verbosity is high enough
  if (options.verbosity && options.verbosity >= 2) {
    result.debugInfo = {
      commandsExecuted: [],
      systemInfo: {
        platform: process.platform,
        nodeVersion: process.version,
        sshVersion: 'Unknown', // Would be populated by actual SSH version check
      },
    };
  }

  // Log the results with appropriate formatting
  sshLogger.subsection('Diagnostic Results');

  // Network connectivity
  if (result.networkConnectivity.success) {
    sshLogger.success('Network connectivity: Host is reachable (ping)');
  } else {
    sshLogger.error('Network connectivity:', result.networkConnectivity.message);
    sshLogger.debug('Possible causes:');
    sshLogger.debug('- Host is offline or unreachable');
    sshLogger.debug('- Network configuration issue');
    sshLogger.debug('- Firewall blocking connection');

    result.networkConnectivity.details = [
      'Host is offline or unreachable',
      'Network configuration issue',
      'Firewall blocking connection',
    ];
  }

  // SSH port connectivity
  if (result.sshPortConnectivity.success) {
    sshLogger.success('SSH port connectivity: SSH port 22 is open');
  } else {
    sshLogger.error('SSH port connectivity:', result.sshPortConnectivity.message);
    sshLogger.debug('Possible causes:');
    sshLogger.debug('- SSH service not running on the server');
    sshLogger.debug('- Firewall blocking SSH port');
    sshLogger.debug('- Incorrect port specified');

    result.sshPortConnectivity.details = [
      'SSH service not running on the server',
      'Firewall blocking SSH port',
      'Incorrect port specified',
    ];
  }

  // SSH authentication
  if (result.sshAuthentication.success) {
    sshLogger.success('Connection successful!');
    if (result.sshAuthentication.method) {
      // Special handling for password-possible and password-required states
      if (
        result.sshAuthentication.method === 'password-possible' ||
        result.sshAuthentication.method === 'password-required'
      ) {
        sshLogger.info(
          `Using password authentication: ${result.sshAuthentication.keyPath || '~/.ssh/id_rsa'}`
        );
        // Update status so other code knows password authentication is needed
        result.sshAuthentication.status = 'rejected'; // Mark as requiring password authentication
      } else if (result.sshAuthentication.method === 'key') {
        sshLogger.info(
          `Using key authentication: ${result.sshAuthentication.keyPath || '~/.ssh/id_rsa'}`
        );
      } else {
        sshLogger.info(`Using ${result.sshAuthentication.method} authentication`);
      }
    }
  } else {
    sshLogger.error('SSH authentication:', result.sshAuthentication.message);
    sshLogger.debug('Possible causes:');
    sshLogger.debug('- Incorrect username or password');
    sshLogger.debug('- SSH key not accepted by the server');
    sshLogger.debug('- Server configuration rejects this authentication method');

    result.sshAuthentication.details = [
      'Incorrect username or password',
      'SSH key not accepted by the server',
      'Server configuration rejects this authentication method',
    ];

    // Add more specific debug information for authentication issues
    if (server.identity_file) {
      sshLogger.debug('For key authentication issues:');
      sshLogger.debug('- Verify that the key file exists and has correct permissions');
      sshLogger.debug("- Check if the public key is in the server's authorized_keys file");
      sshLogger.debug('- Ensure the key format is supported by the server');

      result.sshAuthentication.details.push(
        'Verify that the key file exists and has correct permissions',
        "Check if the public key is in the server's authorized_keys file",
        'Ensure the key format is supported by the server'
      );
    } else {
      sshLogger.debug('For SSH default authentication issues:');
      sshLogger.debug('- Check if default SSH keys exist in ~/.ssh/');
      sshLogger.debug('- Verify that the password is correct (if prompted)');
      sshLogger.debug('- Check if the server allows the authentication methods you are using');

      result.sshAuthentication.details.push(
        'Check if default SSH keys exist in ~/.ssh/',
        'Verify that the password is correct (if prompted)',
        'Check if the server allows the authentication methods you are using'
      );
    }
  }

  // Overall result
  sshLogger.divider();
  if (result.success) {
    sshLogger.success('Connection successful!');
  } else {
    sshLogger.error(`Connection failed: ${result.primaryIssue}`);
    sshLogger.error(result.detailedMessage);

    // Provide troubleshooting commands at the highest verbosity level
    if (options.verbosity && options.verbosity >= 3) {
      sshLogger.subsection('Troubleshooting Commands');

      // Network troubleshooting
      if (result.primaryIssue === 'network') {
        const pingCmd = `ping ${server.hostname}`;
        sshLogger.debug(`Test network connectivity: ${pingCmd}`);
        result.debugInfo?.commandsExecuted.push(pingCmd);
      }

      // Port troubleshooting
      if (result.primaryIssue === 'port') {
        const ncCmd = `nc -zv ${server.hostname} ${server.port}`;
        sshLogger.debug(`Test SSH port: ${ncCmd}`);
        result.debugInfo?.commandsExecuted.push(ncCmd);
      }

      // Authentication troubleshooting
      if (result.primaryIssue === 'authentication') {
        const sshCmd = `ssh -v ${server.user}@${server.hostname} -p ${server.port}`;
        sshLogger.debug(`Manual SSH connection: ${sshCmd}`);
        result.debugInfo?.commandsExecuted.push(sshCmd);

        if (server.identity_file) {
          const keyCmd = `ssh-keygen -l -f ${server.identity_file}`;
          sshLogger.debug(`Check SSH key: ${keyCmd}`);
          result.debugInfo?.commandsExecuted.push(keyCmd);
        }
      }
    }
  }

  return result;
}

/**
 * Run a quick connection test with minimal output
 * @param server Server configuration
 * @returns Success status and message
 */
export async function quickConnectionTest(
  server: ServerConfig
): Promise<{ success: boolean; message: string }> {
  logger.info(`Verifying connection to ${server.user}@${server.hostname}...`);

  const diagnostics = await diagnoseConnection(server, { suppressDebugOutput: true });

  if (diagnostics.overallSuccess) {
    logger.success('Connection successful!');
    return { success: true, message: 'Connection successful' };
  }
  logger.error(`Connection failed: ${diagnostics.primaryIssue}`);
  logger.error(diagnostics.detailedMessage);
  return { success: false, message: diagnostics.detailedMessage };
}

export default {
  runEnhancedDiagnostics,
  quickConnectionTest,
};
