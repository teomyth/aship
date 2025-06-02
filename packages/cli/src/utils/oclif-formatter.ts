/**
 * OCLIF-based formatter for consistent CLI output
 * Provides theme-aware, responsive formatting with proper ANSI handling
 */

import { ux } from '@oclif/core';

export interface CommandDisplayOptions {
  showFullCommand?: boolean;
  maxWidth?: number;
  dryRun?: boolean;
}

export interface SummaryItem {
  label: string;
  value: string | number;
  color?: string;
}

export interface ProgressOptions {
  message: string;
  spinner?: boolean;
}

/**
 * OCLIF-based formatter functions with theme integration
 */

// Constants
const DEFAULT_MAX_WIDTH = 80;
const PREFIX_WIDTH = 4;

// Formatter namespace
export const OCLIFFormatter = {
  DEFAULT_MAX_WIDTH,
  PREFIX_WIDTH,

  /**
   * Display a section header with consistent styling
   */
  section(title: string, content?: string): void {
    ux.stdout('');
    ux.stdout(ux.colorize('sectionHeader', title));
    if (content) {
      ux.stdout(content);
    }
  },

  /**
   * Display a command with smart line wrapping and theme colors
   */
  command(commandParts: string[], options: CommandDisplayOptions = {}): void {
    const { maxWidth = OCLIFFormatter.DEFAULT_MAX_WIDTH, dryRun = false } = options;

    // Display section header
    OCLIFFormatter.section('Command to execute:');

    // Smart line breaking that respects terminal width
    const lines = OCLIFFormatter.wrapCommandParts(
      commandParts,
      maxWidth - OCLIFFormatter.PREFIX_WIDTH
    );

    // Display with proper OCLIF formatting
    lines.forEach((line, index) => {
      const prefix = index === 0 ? `${ux.colorize('aship.commandPrefix', '>')} ` : '  ';
      const styledLine = ux.colorize('aship.commandText', line);
      ux.stdout(`${prefix}${styledLine}`);
    });

    if (dryRun) {
      ux.stdout('');
      ux.stdout(
        ux.colorize('aship.warning', '⚠ Dry run mode: Command preview only, not executing')
      );
    }

    ux.stdout('');
  },

  /**
   * Display execution summary with aligned key-value pairs
   */
  summary(title: string, items: SummaryItem[]): void {
    ux.stdout('');
    ux.stdout(ux.colorize('sectionHeader', title));

    if (items.length === 0) {
      ux.stdout(ux.colorize('aship.muted', '  No items to display'));
      return;
    }

    // Calculate proper alignment (OCLIF handles ANSI codes correctly)
    const maxLabelWidth = Math.max(...items.map(item => item.label.length));

    items.forEach(({ label, value, color }) => {
      const paddedLabel = label.padStart(maxLabelWidth);
      const styledLabel = ux.colorize('aship.label', `${paddedLabel}:`);
      const valueColor = color || 'aship.value';
      const styledValue = ux.colorize(valueColor, `    ${value}`);
      ux.stdout(` ${styledLabel}${styledValue}`);
    });
  },

  /**
   * Display success message with timing information
   */
  success(message: string, executionTime?: number): void {
    ux.stdout('');

    let fullMessage = `✔ ${message}`;
    if (executionTime !== undefined) {
      const timeInSeconds = (executionTime / 1000).toFixed(3);
      fullMessage += ` (${timeInSeconds}s)`;
    }

    ux.stdout(ux.colorize('aship.success', fullMessage));
  },

  /**
   * Display error message with optional details
   */
  error(message: string, details?: string, exitCode?: number): void {
    ux.stdout('');

    let fullMessage = `✗ ${message}`;
    if (exitCode !== undefined) {
      fullMessage += ` (exit code: ${exitCode})`;
    }

    ux.stdout(ux.colorize('aship.error', fullMessage));

    if (details?.trim()) {
      ux.stdout('');
      ux.stdout(ux.colorize('aship.label', 'Error details:'));
      ux.stdout(details);
    }
  },

  /**
   * Display warning message
   */
  warning(message: string): void {
    ux.stdout(ux.colorize('aship.warning', `⚠ ${message}`));
  },

  /**
   * Display info message
   */
  info(message: string): void {
    ux.stdout(ux.colorize('aship.info', `ℹ ${message}`));
  },

  /**
   * Display a list of items with consistent formatting
   */
  list(title: string, items: string[], options: { bullet?: string; color?: string } = {}): void {
    const { bullet = '•', color = 'white' } = options;

    if (title) {
      ux.stdout('');
      ux.stdout(ux.colorize('sectionHeader', title));
    }

    items.forEach(item => {
      ux.stdout(`  ${ux.colorize('aship.muted', bullet)} ${ux.colorize(color, item)}`);
    });
  },

  /**
   * Display a table with key-value pairs
   */
  table(items: Array<{ label: string; value: string }>): void {
    if (items.length === 0) {
      return;
    }

    // Calculate proper alignment
    const maxLabelWidth = Math.max(...items.map(item => item.label.length));

    items.forEach(({ label, value }) => {
      const paddedLabel = label.padStart(maxLabelWidth);
      const styledLabel = ux.colorize('aship.label', `${paddedLabel}:`);
      const styledValue = ux.colorize('aship.value', `    ${value}`);
      ux.stdout(` ${styledLabel}${styledValue}`);
    });
  },

  /**
   * Display a separator line
   */
  separator(width?: number): void {
    const terminalWidth = process.stdout.columns || OCLIFFormatter.DEFAULT_MAX_WIDTH;
    const separatorWidth = width || Math.min(terminalWidth, OCLIFFormatter.DEFAULT_MAX_WIDTH);
    ux.stdout(ux.colorize('aship.separator', '─'.repeat(separatorWidth)));
  },

  /**
   * Create a progress indicator using OCLIF's action
   */
  progress(options: ProgressOptions) {
    const { message, spinner = true } = options;

    if (spinner) {
      ux.action.start(message);
      return {
        update: (newMessage: string) => {
          ux.action.status = newMessage;
        },
        stop: (finalMessage?: string) => {
          ux.action.stop(finalMessage);
        },
      };
    }
    ux.stdout(ux.colorize('aship.info', `${message}...`));
    return {
      update: (newMessage: string) => {
        ux.stdout(ux.colorize('aship.info', `${newMessage}...`));
      },
      stop: (finalMessage?: string) => {
        if (finalMessage) {
          ux.stdout(ux.colorize('aship.success', `✔ ${finalMessage}`));
        }
      },
    };
  },

  /**
   * Display enhanced mode information
   */
  enhancedMode(hosts?: string[], inventory?: string, limit?: string): void {
    OCLIFFormatter.info('Enhanced mode: Using aship host management');

    if (hosts && hosts.length > 0) {
      ux.stdout(
        `  ${ux.colorize('aship.label', 'Aship hosts:')} ${ux.colorize('aship.highlight', hosts.join(', '))}`
      );
    }

    if (inventory) {
      ux.stdout(
        `  ${ux.colorize('aship.label', 'Custom inventory:')} ${ux.colorize('aship.highlight', inventory)}`
      );
    }

    if (limit) {
      ux.stdout(
        `  ${ux.colorize('aship.label', 'Host limit:')} ${ux.colorize('aship.highlight', limit)}`
      );
    }
  },

  /**
   * Smart command line wrapping that respects word boundaries
   */
  wrapCommandParts(parts: string[], maxWidth: number): string[] {
    const lines: string[] = [];
    let currentLine = '';

    for (const part of parts) {
      const testLine = currentLine ? `${currentLine} ${part}` : part;

      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = part;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  },

  /**
   * Display completion report with comprehensive information
   */
  completionReport(
    success: boolean,
    targets: any[],
    playbookPath: string,
    executionTime?: number,
    exitCode?: number,
    stderr?: string
  ): void {
    // Main status message
    if (success) {
      OCLIFFormatter.success('Playbook execution completed successfully', executionTime);
    } else {
      OCLIFFormatter.error('Playbook execution failed', stderr, exitCode);
    }

    // Summary information
    const summaryItems: SummaryItem[] = [
      { label: 'Targets', value: `${targets.length} host${targets.length === 1 ? '' : 's'}` },
      { label: 'Playbook', value: playbookPath, color: 'aship.highlight' },
    ];

    if (executionTime !== undefined) {
      const timeInSeconds = (executionTime / 1000).toFixed(3);
      summaryItems.push({ label: 'Duration', value: `${timeInSeconds}s` });
    }

    OCLIFFormatter.summary('Execution Summary', summaryItems);
  },
};
