import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execPromise = promisify(exec);

/**
 * Execute a command and return the result
 * @param command Command to execute
 * @returns Command result
 */
export async function executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execPromise(command);
  } catch (error: any) {
    // If the command fails, return the error output
    if (error && (error.stdout || error.stderr)) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
      };
    }
    throw error;
  }
}
