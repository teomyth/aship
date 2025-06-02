import type { Hook } from '@oclif/core';

/**
 * Hook that runs when a command is not found
 * This implements the default command behavior by redirecting unknown commands to 'run'
 */
export const hook: Hook.CommandNotFound = async opts => {
  // Handle topic:command format (e.g., "hello:world" -> "hello world")
  // OCLIF interprets "hello world" as "hello:world" topic:command
  // For playbook names, we should treat this as a single argument
  let runArgs: string[];
  if (opts.id.includes(':')) {
    // Convert topic:command back to a single space-separated argument
    // This handles cases like "hello world" -> "hello:world" -> "hello world"
    const playbookName = opts.id.replace(':', ' ');
    runArgs = [playbookName, ...(opts.argv || [])];
  } else {
    // Single command name
    runArgs = [opts.id, ...(opts.argv || [])];
  }

  // Run the 'run' command with the processed arguments
  // This allows users to run 'aship site.yml' instead of 'aship run site.yml'
  await opts.config.runCommand('run', runArgs);
};

export default hook;
