/**
 * Logger utility for Aship
 * Provides consistent logging across the application with support for different verbosity levels
 */

import chalk from 'chalk';
import figures from 'figures';

// Define ChalkFunction type since it's not exported from chalk
type ChalkFunction = (text: string | number) => string;

/**
 * Log levels
 */
export enum LogLevel {
  SILENT = 0, // No output
  ERROR = 1, // Only errors
  WARN = 2, // Errors and warnings
  INFO = 3, // Normal output (default)
  VERBOSE = 4, // More detailed output (-v)
  DEBUG = 5, // Debug information (-vv)
  TRACE = 6, // Trace information (-vvv)
}

/**
 * Logger configuration
 */
interface LoggerConfig {
  level: LogLevel;
  timestamps: boolean;
  prefix: string;
}

/**
 * Logger class
 */
export class Logger {
  private config: LoggerConfig = {
    level: LogLevel.INFO,
    timestamps: false,
    prefix: '',
  };

  /**
   * Set the log level
   * @param level Log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get the current log level
   * @returns Current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set the log level from verbosity flags
   * @param verboseFlags Number of verbose flags (e.g., -v, -vv, -vvv)
   */
  setVerbosity(verboseFlags: number): void {
    // Map verbosity to log levels
    // 0 = INFO, 1 = VERBOSE, 2 = DEBUG, 3+ = TRACE
    const level = Math.min(LogLevel.INFO + verboseFlags, LogLevel.TRACE);
    this.setLevel(level);
  }

  /**
   * Get the current verbosity level
   * @returns Current verbosity level (0 = INFO, 1 = VERBOSE, 2 = DEBUG, 3+ = TRACE)
   */
  getVerbosity(): number {
    // Convert log level back to verbosity flags
    return Math.max(this.config.level - LogLevel.INFO, 0);
  }

  /**
   * Enable or disable timestamps
   * @param enable Whether to enable timestamps
   */
  setTimestamps(enable: boolean): void {
    this.config.timestamps = enable;
  }

  /**
   * Set a prefix for all log messages
   * @param prefix Prefix string
   */
  setPrefix(prefix: string): void {
    this.config.prefix = prefix;
  }

  /**
   * Create a child logger with a specific prefix
   * @param prefix Prefix for the child logger
   * @returns Child logger
   */
  createChild(prefix: string): Logger {
    const childLogger = new Logger();
    childLogger.config = { ...this.config };
    childLogger.config.prefix = this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix;
    return childLogger;
  }

  /**
   * Format a log message
   * @param icon Icon to use
   * @param color Chalk color function
   * @param message Message to log
   * @param args Additional arguments
   * @returns Formatted message
   */
  private format(icon: string, color: ChalkFunction, message: string, ...args: any[]): string {
    let formattedMessage = '';

    // Add timestamp if enabled
    if (this.config.timestamps) {
      const timestamp = new Date().toISOString();
      formattedMessage += chalk.gray(`[${timestamp}] `);
    }

    // Add prefix if set
    if (this.config.prefix) {
      formattedMessage += chalk.gray(`[${this.config.prefix}] `);
    }

    // Add icon and message
    formattedMessage += `${color(icon)} ${color(message)}`;

    // Format additional arguments
    if (args.length > 0) {
      // If the first argument is an object, format it nicely
      if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
        try {
          const formatted = JSON.stringify(args[0], null, 2);
          formattedMessage += `\n${formatted}`;
        } catch (_error) {
          formattedMessage += ` ${args[0]}`;
        }
      } else {
        // Otherwise just append all arguments
        formattedMessage += ` ${args.join(' ')}`;
      }
    }

    return formattedMessage;
  }

  /**
   * Log an error message
   * @param message Message to log
   * @param args Additional arguments
   */
  error(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.ERROR) {
      console.error(this.format('✖', chalk.red, message, ...args));
    }
  }

  /**
   * Log a warning message
   * @param message Message to log
   * @param args Additional arguments
   */
  warn(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.WARN) {
      console.warn(this.format('⚠', chalk.yellow, message, ...args));
    }
  }

  /**
   * Log an info message
   * @param message Message to log
   * @param args Additional arguments
   */
  info(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.INFO) {
      console.log(this.format('ℹ', chalk.blue, message, ...args));
    }
  }

  /**
   * Log a success message
   * @param message Message to log
   * @param args Additional arguments
   */
  success(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.INFO) {
      console.log(this.format('✔', chalk.green, message, ...args));
    }
  }

  /**
   * Log a verbose message
   * @param message Message to log
   * @param args Additional arguments
   */
  verbose(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.VERBOSE) {
      // 使用箭头符号 → 而不是 figures.arrowRight
      console.log(this.format('→', chalk.cyan, message, ...args));
    }
  }

  /**
   * Log a debug message
   * @param message Message to log
   * @param args Additional arguments
   */
  debug(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.DEBUG) {
      console.log(this.format(figures.pointer, chalk.magenta, message, ...args));
    }
  }

  /**
   * Log a trace message
   * @param message Message to log
   * @param args Additional arguments
   */
  trace(message: string, ...args: any[]): void {
    if (this.config.level >= LogLevel.TRACE) {
      console.log(this.format(figures.ellipsis, chalk.gray, message, ...args));
    }
  }

  /**
   * Log a plain message without any formatting
   * @param message Message to log
   */
  plain(message: string): void {
    if (this.config.level >= LogLevel.INFO) {
      // 如果有前缀，添加前缀
      if (this.config.prefix) {
        console.log(`${chalk.gray(`[${this.config.prefix}]`)} ${message}`);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Log a section header
   * @param title Section title
   */
  section(title: string): void {
    if (this.config.level >= LogLevel.INFO) {
      console.log('');
      console.log(chalk.bold.cyan(`▶ ${title}`));
      console.log(chalk.cyan('='.repeat(title.length + 4)));
    }
  }

  /**
   * Log a subsection header
   * @param title Subsection title
   */
  subsection(title: string): void {
    if (this.config.level >= LogLevel.INFO) {
      console.log('');
      console.log(chalk.bold.blue(`❯ ${title}`));
      console.log(chalk.blue('-'.repeat(title.length + 4)));
    }
  }

  /**
   * Create a spinner for long-running operations
   * Note: This is a placeholder. In a real implementation, you would use a library like ora.
   * @param text Spinner text
   * @returns Object with start, stop, and update methods
   */
  spinner(text: string): {
    start: () => void;
    stop: (success?: boolean) => void;
    update: (text: string) => void;
  } {
    return {
      start: () => {
        if (this.config.level >= LogLevel.INFO) {
          console.log(chalk.cyan(`${figures.pointer} ${text}...`));
        }
      },
      stop: (success = true) => {
        if (this.config.level >= LogLevel.INFO) {
          const icon = success ? figures.tick : figures.cross;
          const color = success ? chalk.green : chalk.red;
          console.log(color(`${icon} ${text}`));
        }
      },
      update: (newText: string) => {
        if (this.config.level >= LogLevel.INFO) {
          console.log(chalk.cyan(`${figures.pointer} ${newText}...`));
        }
      },
    };
  }

  /**
   * Log a command execution
   * @param command Command being executed
   */
  command(command: string): void {
    if (this.config.level >= LogLevel.INFO) {
      console.log('');
      console.log(chalk.cyan('→ Executing command:'));
      console.log(chalk.white.bgBlack(` ${command} `));
      console.log('');
    }
  }

  /**
   * Log a divider line
   */
  divider(): void {
    if (this.config.level >= LogLevel.INFO) {
      console.log(chalk.gray('─'.repeat(80)));
    }
  }

  /**
   * Log operation feedback with indentation (for connection tests, etc.)
   * @param message Feedback message
   * @param success Success state: true=success, false=error, undefined=in-progress
   */
  feedback(message: string, success?: boolean): void {
    if (this.config.level >= LogLevel.INFO) {
      let icon = '';
      let color = chalk.gray;

      if (success === true) {
        icon = '✔ ';
        color = chalk.green;
      } else if (success === false) {
        icon = '✗ ';
        color = chalk.red;
      }

      console.log(`${color(icon)}${message}`);
    }
  }

  /**
   * Create a section separator for Ansible output or other long content
   * @param title Section title
   */
  ansibleSection(title = 'Ansible Output'): void {
    if (this.config.level >= LogLevel.INFO) {
      const separator = '─'.repeat(7);
      console.log(`\n  ${separator} ${title} ${separator}`);
    }
  }

  /**
   * End an Ansible section
   */
  ansibleSectionEnd(): void {
    // No separator or blank line needed
  }
}

/**
 * Global logger instance
 */
export const logger = new Logger();

/**
 * Export default logger
 */
export default logger;
